"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// If you prefer to keep using dynamic import, remove it from the “expanded only” approach:
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLatBoundsLike } from "mapbox-gl";

let mapboxgl: typeof import("mapbox-gl") | null = null;

// In Next.js, typically read from process.env:
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MapCardProps {
  coordinates: [number, number]; // [longitude, latitude]
  name: string;                  // Station name
  address: string;               // Station address
  className?: string;
}

export default function MapCard({
  coordinates,
  name,
  address,
  className,
}: MapCardProps) {
  /**
   * STATE + REFS
   */
  const [expanded, setExpanded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  // We'll store the "map container" DOM node in a ref:
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // The Mapbox Map instance (one time creation).
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // We store a separate <div> cardRef that we can move from StationDetail to <body> (portal)
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Keep track of the portal root element
  const [portalElem, setPortalElem] = useState<HTMLElement | null>(null);

  /**
   * On first mount, fetch the portal root if it exists.
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const el = document.getElementById("portal-root");
      setPortalElem(el);
    }
  }, []);

  /**
   * Create the map exactly once on mount (not tied to "expanded" state).
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!mapboxgl) {
          // Import mapbox-gl once; store it globally so we don't import repeatedly
          const mod = await import("mapbox-gl");
          mapboxgl = mod.default;
          mapboxgl.accessToken = MAPBOX_TOKEN;
        }

        if (!mapContainerRef.current || cancelled) return;

        // Create a single map instance
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: coordinates,
          zoom: 12.5,
          pitch: 40,
          bearing: 0,
          interactive: true,
          attributionControl: false,
          maxBounds: getBoundingBox(coordinates),
          minZoom: 11,
          maxZoom: 19,
        });

        // On load
        mapRef.current.on("load", () => {
          if (cancelled) return;
          setMapLoaded(true);

          // Attempt 3D building layer
          try {
            mapRef.current?.addLayer({
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 14,
              paint: {
                "fill-extrusion-color": "#aaa",
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.6,
              },
            });
          } catch (err) {
            console.warn("Could not add 3D buildings layer:", err);
          }

          // Add marker & animate
          markerRef.current = new mapboxgl!.Marker({ color: "#3b82f6" })
            .setLngLat(coordinates)
            .addTo(mapRef.current!);

          startMarkerAnimation();
          startEntranceAnimation();
        });

        mapRef.current.on("error", (e: any) => {
          console.error("Mapbox error:", e);
        });
      } catch (err) {
        console.error("Failed to initialize Mapbox:", err);
      }
    })();

    return () => {
      // Cleanup in case component unmounts quickly
      cancelled = true;
      destroyMap();
    };
  }, [coordinates]);

  /**
   * Resize the map whenever the window resizes (only if mapRef is ready).
   */
  useEffect(() => {
    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * MARKER ANIMATION
   */
  const startMarkerAnimation = () => {
    if (!markerRef.current) return;
    const markerEl = markerRef.current.getElement();

    const scaleFactor = 1.1;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      if (!markerRef.current) return; // marker removed => end
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      const scale = 1 + (Math.sin(progress * Math.PI * 2) * 0.5 + 0.5) * (scaleFactor - 1);

      const currentTransform = markerEl.style.transform || "";
      const scaleMatch = currentTransform.match(/scale\([0-9.]+\)/);
      const newTransform = scaleMatch
        ? currentTransform.replace(scaleMatch[0], `scale(${scale})`)
        : `${currentTransform} scale(${scale})`;

      markerEl.style.transform = newTransform;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const destroyMarkerAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  /**
   * CAMERA "FLY IN" ANIMATION
   */
  const startEntranceAnimation = () => {
    if (!mapRef.current) return;
    const mapInstance = mapRef.current;

    const startZoom = mapInstance.getZoom();
    const startBearing = mapInstance.getBearing();
    const startPitch = mapInstance.getPitch();

    const targetZoom = 16.5;
    const targetBearing = 45;
    const targetPitch = 65;

    const duration = 2500;
    const startTime = Date.now();

    const animate = () => {
      if (!mapRef.current) return; // map destroyed => end
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      const newZoom = startZoom + (targetZoom - startZoom) * ease;
      const newBearing = startBearing + (targetBearing - startBearing) * ease;
      const newPitch = startPitch + (targetPitch - startPitch) * ease;

      mapInstance.setZoom(newZoom);
      mapInstance.setBearing(newBearing);
      mapInstance.setPitch(newPitch);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  /**
   * DESTROY MAP
   */
  const destroyMap = useCallback(() => {
    destroyMarkerAnimation();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markerRef.current = null;
    setMapLoaded(false);
  }, []);

  /**
   * TOGGLE EXPANDED
   */
  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
    // After the card re-renders, forcibly resize & recenter the marker
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
        if (markerRef.current) {
          const pos = markerRef.current.getLngLat();
          markerRef.current.setLngLat(pos);
        }
      }
    }, 300);
  };

  /**
   * THE CARD CONTENT ITSELF
   * We attach ref to a <div> so we can "move" it if expanded is true.
   */
  const card = (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700",
        expanded ? "fixed inset-4 z-[9999]" : "h-52",
        className
      )}
    >
      {/* The actual map container (always present) */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 bg-gray-800"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Loading overlay if map not done yet */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Expand/minimize button */}
      <div className="absolute top-2 right-2 flex space-x-2 z-10">
        <button
          onClick={toggleExpanded}
          className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
          aria-label={expanded ? "Minimize map" : "Maximize map"}
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom overlay with station name & address */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 p-3"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)",
        }}
      >
        <div className="text-white text-sm font-medium">{name}</div>
        <div className="text-gray-200 text-xs mt-0.5">{address}</div>
      </div>
    </motion.div>
  );

  /**
   * If expanded & we have a portal root, move the entire `card` to <div id="portal-root" />
   * This ensures it escapes any parent transform / overflow and can truly go fullscreen.
   */
  if (expanded && portalElem) {
    return createPortal(card, portalElem);
  }
  // Otherwise, render inline (in StationDetail)
  return card;
}

/* -----------------------------------------
   Helper Functions
----------------------------------------- */

/** Return a bounding box as [ [minLng, minLat], [maxLng, maxLat] ] */
function getBoundingBox(center: [number, number], radiusKm = 0.25): LngLatBoundsLike {
  const earthRadiusKm = 6371;
  const latRadian = (center[1] * Math.PI) / 180;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lngDelta =
    (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);

  // Return SW + NE corners
  return [
    [center[0] - lngDelta, center[1] - latDelta],
    [center[0] + lngDelta, center[1] + latDelta],
  ];
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
