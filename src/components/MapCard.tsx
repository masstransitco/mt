// src/components/MapCard.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Set your Mapbox access token
// Note: In production, use environment variables
mapboxgl.accessToken = "pk.eyJ1IjoiZXhhbXBsZXVzZXIiLCJhIjoiY2syZzRqcGl1MDFtbTNocGJ1bm91eGVzMCJ9.example";

interface MapCardProps {
  coordinates: [number, number]; // [longitude, latitude]
  name: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  isOpen,
  onClose,
  className,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Initialize and set up map when component mounts or when coordinates change
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    // Initialize map only if it doesn't exist yet
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11", // Dark theme
        center: coordinates,
        zoom: 17,
        pitch: 45, // Tilt the map 45 degrees
        bearing: 0,
        attributionControl: false,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Add 3D building layer
      map.current.on("load", () => {
        if (!map.current) return;

        // Add 3D buildings
        map.current.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.8,
          },
        });

        // Add a marker at the station location
        new mapboxgl.Marker({
          color: "#3b82f6", // Blue color matching the app theme
        })
          .setLngLat(coordinates)
          .addTo(map.current);

        // Start an entrance animation
        startEntranceAnimation();
      });
    } else {
      // If map exists, just update the center
      map.current.setCenter(coordinates);
      startEntranceAnimation();
    }

    // Cleanup function
    return () => {
      // Don't destroy the map on each render, only when the component unmounts
      // We'll handle this separately
    };
  }, [coordinates, isOpen]);

  // Clean up the map when component unmounts
  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Entrance animation function
  const startEntranceAnimation = () => {
    if (!map.current) return;

    const startZoom = map.current.getZoom();
    const startBearing = map.current.getBearing();
    const targetZoom = 18;
    const targetBearing = 30;

    // Create animation
    const animationDuration = 2000; // 2 seconds
    const start = Date.now();

    const animate = () => {
      const elapsedMs = Date.now() - start;
      const progress = Math.min(elapsedMs / animationDuration, 1);
      const easeProgress = easeInOutCubic(progress);

      if (map.current) {
        // Interpolate between start and target values
        const newZoom = startZoom + (targetZoom - startZoom) * easeProgress;
        const newBearing = startBearing + (targetBearing - startBearing) * easeProgress;

        map.current.setZoom(newZoom);
        map.current.setBearing(newBearing);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
    };

    // Start animation
    requestAnimationFrame(animate);
  };

  // Easing function for smoother animation
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
          {/* Map container */}
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Overlay with controls */}
          <div className="absolute top-2 right-2 flex space-x-2">
            <button
              onClick={toggleExpanded}
              className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            >
              {expanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Location name overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <div className="text-white text-sm font-medium">{name}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapCard;
