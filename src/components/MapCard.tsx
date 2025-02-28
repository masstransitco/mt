// src/components/MapCard.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Import styles directly in the component
import "mapbox-gl/dist/mapbox-gl.css";
import "@/styles/mapbox.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

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
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  
  // Set appropriate bounds around the station location
  const getBoundingBox = (center: [number, number], radiusKm: number = 0.15) => {
    const earthRadiusKm = 6371;
    const latRadian = center[1] * Math.PI / 180;
    
    // Convert radius to degrees (approximately)
    const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const lngDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);
    
    return new mapboxgl.LngLatBounds(
      [center[0] - lngDelta, center[1] - latDelta], // Southwest
      [center[0] + lngDelta, center[1] + latDelta]  // Northeast
    );
  };

  // Initialize and set up map when component mounts or when coordinates change
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;
    
    // Calculate bounds
    const bounds = getBoundingBox(coordinates);

    // Initialize map only if it doesn't exist yet
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11", // Dark theme
        center: coordinates,
        zoom: 17.5,
        pitch: 65, // More dramatic tilt
        bearing: 0,
        maxBounds: bounds, // Restrict map movement
        minZoom: 16.5,     // Prevent zooming out too far
        maxZoom: 19.5,     // Limit max zoom
        attributionControl: false,
        // Disable UI controls and rely on gestures
        boxZoom: false,
        doubleClickZoom: true,
        keyboard: false,
      });

      // Add 3D building layer
      map.current.on("load", () => {
        if (!map.current) return;

        // Fix: Instead of using data expressions for fill-extrusion-opacity,
        // use a consistent opacity value
        map.current.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            // Fixed blue color for all buildings
            "fill-extrusion-color": "#3b82f6", 
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15, 0,
              16, ["get", "height"]
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"], 
              ["zoom"],
              15, 0,
              16, ["get", "min_height"]
            ],
            // Fixed opacity value
            "fill-extrusion-opacity": 0.7
          }
        });

        // Add a second layer for all other buildings in gray
        map.current.addLayer({
          id: "other-buildings",
          source: "composite",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15, 0,
              16, ["get", "height"]
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"], 
              ["zoom"],
              15, 0,
              16, ["get", "min_height"]
            ],
            "fill-extrusion-opacity": 0.5
          },
          // Add this before the 3d-buildings layer
        }, "3d-buildings");

        // Add a glowing marker at the station location
        const el = document.createElement("div");
        el.className = "station-marker pulse";
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#3b82f6";
        el.style.boxShadow = "0 0 10px 2px rgba(59, 130, 246, 0.8)";
        
        new mapboxgl.Marker(el)
          .setLngLat(coordinates)
          .addTo(map.current);

        // Create a small circle at the exact station point to highlight that specific building
        map.current.addSource('station-point', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coordinates
            },
            properties: {}
          }
        });

        map.current.addLayer({
          id: 'station-point-glow',
          type: 'circle',
          source: 'station-point',
          paint: {
            'circle-radius': 15,
            'circle-color': '#3b82f6',
            'circle-opacity': 0.4,
            'circle-blur': 0.5
          }
        });

        map.current.addLayer({
          id: 'station-point',
          type: 'circle',
          source: 'station-point',
          paint: {
            'circle-radius': 6,
            'circle-color': '#3b82f6',
            'circle-opacity': 0.8
          }
        });

        // Start entrance animation
        startEntranceAnimation();
      });
    } else {
      // If map exists, just update the center and bounds
      map.current.setCenter(coordinates);
      map.current.setMaxBounds(bounds);
      startEntranceAnimation();
    }

    // Cleanup function for this effect only
    return () => {
      // We don't remove the map here, only on final unmount
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

  // Entrance animation with improved camera movement
  const startEntranceAnimation = () => {
    if (!map.current) return;

    const startZoom = map.current.getZoom();
    const startBearing = map.current.getBearing();
    const startPitch = map.current.getPitch();
    
    const targetZoom = 18.2;
    const targetBearing = 45; // More dramatic rotation
    const targetPitch = 70;   // Look more directly at the building

    // Create animation
    const animationDuration = 2500; // 2.5 seconds
    const start = Date.now();

    const animate = () => {
      const elapsedMs = Date.now() - start;
      const progress = Math.min(elapsedMs / animationDuration, 1);
      const easeProgress = easeInOutCubic(progress);

      if (map.current) {
        // Interpolate between start and target values
        const newZoom = startZoom + (targetZoom - startZoom) * easeProgress;
        const newBearing = startBearing + (targetBearing - startBearing) * easeProgress;
        const newPitch = startPitch + (targetPitch - startPitch) * easeProgress;

        map.current.setZoom(newZoom);
        map.current.setBearing(newBearing);
        map.current.setPitch(newPitch);

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
    
    // Resize the map after toggle to ensure it renders correctly
    if (map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 300); // After animation completes
    }
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
              aria-label={expanded ? "Minimize map" : "Maximize map"}
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
              aria-label="Close map"
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
