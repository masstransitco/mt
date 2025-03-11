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
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLatBoundsLike } from "mapbox-gl";

/**
 * We'll store the "default export" from mapbox-gl in this variable
 * (rather than the entire module). E.g. let mapboxglLocal = mapboxgl.
 */
let mapboxglLocal: typeof import("mapbox-gl").default | null = null;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MapCardProps {
  coordinates: [number, number]; // [lng, lat]
  name: string;
  address: string;
  className?: string;
}

export default function MapCard({
  coordinates,
  name,
  address,
  className,
}: MapCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [portalElem, setPortalElem] = useState<HTMLElement | null>(null);

  /**
   * On mount: find #portal-root for expanded full-screen mode
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalElem(document.getElementById("portal-root"));
    }
  }, []);

  /**
   * Create the map once on mount
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!mapboxglLocal) {
          // 1) Import the default export: mapbox-gl
          const { default: mapboxGL } = await import("mapbox-gl");
          // 2) Set the accessToken on that default export
          mapboxGL.accessToken = MAPBOX_TOKEN;
          // 3) Store in our top-level variable for future use
          mapboxglLocal = mapboxGL;
        }

        if (!mapContainerRef.current || cancelled) return;

        // 4) Create the map
        mapRef.current = new mapboxglLocal!.Map({
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

          // Try adding a 3D building layer
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

          // Add marker + animate it
          markerRef.current = new mapboxglLocal!.Marker({ color: "#3b82f6" })
            .setLngLat(coordinates)
            .addTo(mapRef.current!);

          startMarkerAnimation();
          startEntranceAnimation();
        });

        // Error
        mapRef.current.on("error", (e) => {
          console.error("Mapbox error:", e);
        });
      } catch (err) {
        console.error("Error loading mapbox-gl or creating map:", err);
      }
    })();

    // Cleanup
    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [coordinates]);

  /**
   * If window resizes => resize the map
   */
  useEffect(() => {
    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Toggling expanded => move to portal for full screen
   */
  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
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
   * Destroy the map on unmount
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
   * Marker pulsing animation
   */
  const startMarkerAnimation = () => {
    if (!markerRef.current) return;
    const markerEl = markerRef.current.getElement();

    const scaleFactor = 1.1;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      if (!markerRef.current) return;
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      const scale =
        1 + (Math.sin(progress * Math.PI * 2) * 0.5 + 0.5) * (scaleFactor - 1);

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

  /**
   * Cancel marker animation
   */
  const destroyMarkerAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  /**
   * "Fly in" camera effect
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
      if (!mapRef.current) return;
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
   * The card UI
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
      {/* The map container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 bg-gray-800"
        style={{ width: "100%", height: "100%" }}
      />
      {/* If the map hasn't loaded yet => show a spinner */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Expand/minimize button */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={toggleExpanded}
          className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition"
          aria-label={expanded ? "Minimize map" : "Maximize map"}
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Station label overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 p-3"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)",
        }}
      >
        <div className="text-white text-sm font-medium">{name}</div>
        <div className="text-gray-200 text-xs mt-0.5">{address}</div>
      </div>
    </motion.div>
  );

  // If expanded => portal it, else inline
  if (expanded && portalElem) {
    return createPortal(card, portalElem);
  }
  return card;
}

/** 
 * Return a bounding box around [lng, lat] with a small radius (km).
 * Interpreted by Mapbox as [ [minLng, minLat], [maxLng, maxLat] ].
 */
function getBoundingBox(
  center: [number, number],
  radiusKm = 0.25
): LngLatBoundsLike {
  const earthRadiusKm = 6371;
  const latRadian = (center[1] * Math.PI) / 180;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lngDelta =
    (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);

  return [
    [center[0] - lngDelta, center[1] - latDelta],
    [center[0] + lngDelta, center[1] + latDelta],
  ];
}

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
