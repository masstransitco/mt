"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "mapbox-gl/dist/mapbox-gl.css";

// Set your Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MapCardProps {
  coordinates: [number, number]; // [longitude, latitude]
  name: string;                  // Station name
  address: string;               // Station address
  className?: string;
}

/**
 * A component that always shows the map by default, with an optional “expand” mode
 * using a React portal to ensure full-screen layout.
 */
const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  address,
  className,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Basic bounding box logic
  const getBoundingBox = (center: [number, number], radiusKm: number = 0.25) => {
    const earthRadiusKm = 6371;
    const latRadian = (center[1] * Math.PI) / 180;

    const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const lngDelta =
      (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);

    return new mapboxgl.LngLatBounds(
      [center[0] - lngDelta, center[1] - latDelta], // SW
      [center[0] + lngDelta, center[1] + latDelta]  // NE
    );
  };

  // Animate marker gently
  const animateMarker = () => {
    if (!marker.current) return;
    const markerEl = marker.current.getElement();

    const scaleFactor = 1.1;
    const duration = 1500;
    const start = Date.now();
    let frameId: number | null = null;

    const animate = () => {
      if (!marker.current) return;
      const elapsed = Date.now() - start;
      const progress = (elapsed % duration) / duration;

      // sine wave from 0 -> 1 -> 0
      const scale = 1 + (Math.sin(progress * Math.PI * 2) * 0.5 + 0.5) * (scaleFactor - 1);

      const currentEl = marker.current.getElement();
      const currentTransform = currentEl.style.transform || "";
      const scaleMatch = currentTransform.match(/scale\([0-9.]+\)/);
      const newTransform = scaleMatch
        ? currentTransform.replace(scaleMatch[0], `scale(${scale})`)
        : `${currentTransform} scale(${scale})`;

      currentEl.style.transform = newTransform;
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  };

  // Initialize the map on mount
  useEffect(() => {
    if (!mapContainer.current) return;

    // Set bounding box for focus
    const bounds = getBoundingBox(coordinates);

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: coordinates,
        zoom: 12.5,
        pitch: 40,
        bearing: 0,
        interactive: true,
        attributionControl: false,
        maxBounds: bounds,
        minZoom: 11,
        maxZoom: 19,
      });

      map.current.on("load", () => {
        setMapInitialized(true);

        // Attempt to add 3D buildings
        try {
          map.current?.addLayer({
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
        } catch (error) {
          console.warn("Could not add 3D buildings layer:", error);
        }

        // Add a marker
        marker.current = new mapboxgl.Marker({
          color: "#3b82f6",
        })
          .setLngLat(coordinates)
          .addTo(map.current!);

        // Kick off marker pulsing
        animateMarker();

        // “Fly in” or “zoom in” effect
        startEntranceAnimation(map.current!);
      });

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e);
      });
    } catch (err) {
      console.error("Error initializing Mapbox:", err);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      marker.current = null;
    };
  }, [coordinates]);

  // Entrance camera animation
  const startEntranceAnimation = (mapInstance: mapboxgl.Map) => {
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
      const easeProgress = easeInOutCubic(progress);

      const newZoom = startZoom + (targetZoom - startZoom) * easeProgress;
      const newBearing = startBearing + (targetBearing - startBearing) * easeProgress;
      const newPitch = startPitch + (targetPitch - startPitch) * easeProgress;

      mapInstance.setZoom(newZoom);
      mapInstance.setBearing(newBearing);
      mapInstance.setPitch(newPitch);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  // Easing function
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Handle window resize to keep map sized
  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Expand or minimize
  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
    // Wait briefly, then resize the map
    setTimeout(() => {
      if (map.current) {
        map.current.resize();
        // Recenter the marker if needed
        if (marker.current) {
          const pos = marker.current.getLngLat();
          marker.current.setLngLat(pos);
        }
      }
    }, 300);
  };

  // This is our main card UI (for both collapsed & expanded)
  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700",
        // When expanded, go “fixed inset-4” to appear near fullscreen
        expanded ? "fixed inset-4 z-50" : "h-52",
        className
      )}
    >
      {/* Map container */}
      <div
        ref={mapContainer}
        className="absolute inset-0 bg-gray-800"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Loading overlay if map not done yet */}
      {!mapInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Expand/minimize button in top-right */}
      <div className="absolute top-2 right-2 flex space-x-2 z-10">
        <button
          onClick={toggleExpanded}
          className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
          aria-label={expanded ? "Minimize map" : "Maximize map"}
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom overlay for station name + address */}
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

  // If expanded, portal the cardContent to <div id="portal-root" />
  if (expanded) {
    return createPortal(cardContent, document.getElementById("portal-root")!);
  }

  // If not expanded, just render in place
  return cardContent;
};

export default MapCard;
