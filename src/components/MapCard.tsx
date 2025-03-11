"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "mapbox-gl/dist/mapbox-gl.css";

// We can import type only to avoid bundling mapbox in SSR
import type { LngLatBoundsLike } from "mapbox-gl";

// We'll dynamically import mapbox-gl only after expanding.
const importMapbox = () => import("mapbox-gl");

// In Next.js, you typically read from process.env.NEXT_PUBLIC_...
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MapCardProps {
  coordinates: [number, number]; // [longitude, latitude]
  name: string;                  // Station name
  address: string;               // Station address
  className?: string;
}

const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  address,
  className,
}) => {
  // Refs & states
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);     
  const markerRef = useRef<any>(null);  
  const animFrameRef = useRef<number | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Keep track of the portal element (avoid “null container” errors)
  const [portalElem, setPortalElem] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // We’re on the client side, so do a check for #portal-root
    if (typeof window !== "undefined") {
      const el = document.getElementById("portal-root");
      setPortalElem(el);
    }
  }, []);

  // === Create/destroy the Map when expanded/collapsed
  useEffect(() => {
    if (expanded) {
      createMap();
    } else {
      destroyMap();
    }
    return () => destroyMap();
  }, [expanded]);

  // === If user resizes window while expanded => resize map
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    if (expanded) {
      window.addEventListener("resize", handleResize);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, [expanded]);

  // === Create map using dynamic import
  const createMap = useCallback(async () => {
    if (!mapContainer.current || mapRef.current) return; // Map already created or container missing

    try {
      const mapbox = await importMapbox();
      mapbox.default.accessToken = MAPBOX_TOKEN;

      const bounds = getBoundingBox(coordinates); // typed as LngLatBoundsLike

      mapRef.current = new mapbox.default.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: coordinates,
        zoom: 12.5,
        pitch: 40,
        bearing: 0,
        interactive: true,
        attributionControl: false,
        maxBounds: bounds, // No more TS error
        minZoom: 11,
        maxZoom: 19,
      });

      mapRef.current.on("load", () => {
        setMapLoaded(true);
        // Attempt 3D buildings
        try {
          mapRef.current.addLayer({
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
        markerRef.current = new mapbox.default.Marker({ color: "#3b82f6" })
          .setLngLat(coordinates)
          .addTo(mapRef.current);
        startMarkerAnimation();

        // Fly-in effect
        startEntranceAnimation(mapRef.current);
      });

      mapRef.current.on("error", (e: any) => {
        console.error("Mapbox error:", e);
      });
    } catch (err) {
      console.error("Error loading mapbox-gl or creating map:", err);
    }
  }, [coordinates]);

  // === Destroy the map
  const destroyMap = useCallback(() => {
    // Cancel marker animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // Remove map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markerRef.current = null;
    setMapLoaded(false);
  }, []);

  // === Marker pulsing animation
  const startMarkerAnimation = () => {
    if (!markerRef.current) return;
    const markerEl = markerRef.current.getElement();

    const scaleFactor = 1.1;
    const duration = 1500;
    const start = Date.now();

    const animate = () => {
      if (!markerRef.current) return; // if map removed
      const elapsed = Date.now() - start;
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

  // === Entrance camera animation
  const startEntranceAnimation = (mapInstance: any) => {
    const startZoom = mapInstance.getZoom();
    const startBearing = mapInstance.getBearing();
    const startPitch = mapInstance.getPitch();

    const targetZoom = 16.5;
    const targetBearing = 45;
    const targetPitch = 65;

    const duration = 2500;
    const startTime = Date.now();

    const animate = () => {
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

  // === Toggle expanded
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

  // === The main card content
  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700",
        expanded ? "fixed inset-4 z-50" : "h-52",
        className
      )}
    >
      {/* Map container (placeholder when collapsed) */}
      <div
        ref={mapContainer}
        className="absolute inset-0 bg-gray-800"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Spinner while map is loading in expanded mode */}
      {!mapLoaded && expanded && (
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

  // === If expanded and we have a valid portal element, portal it
  if (expanded && portalElem) {
    return createPortal(cardContent, portalElem);
  }

  // Otherwise, render inline (collapsed or no portal root available)
  return cardContent;
};

export default MapCard;


/* -----------------------------------------
   Helper Functions
----------------------------------------- */

/** Return a two-element array representing SW and NE corners. */
function getBoundingBox(
  center: [number, number],
  radiusKm = 0.25
): LngLatBoundsLike {
  const earthRadiusKm = 6371;
  const latRadian = (center[1] * Math.PI) / 180;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lngDelta =
    (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);

  // Return as [[lng1, lat1], [lng2, lat2]]
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
