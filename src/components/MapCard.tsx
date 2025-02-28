// src/components/MapCard.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Import styles directly in the component
import "mapbox-gl/dist/mapbox-gl.css";

// Set your access token
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
  const [mapInitialized, setMapInitialized] = useState(false);

  // Set appropriate bounds around the station location
  const getBoundingBox = (center: [number, number], radiusKm: number = 0.2) => {
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

  // Initialize the map when component mounts
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;
    
    console.log("Initializing map with coordinates:", coordinates);
    
    // Calculate bounds for the map
    const bounds = getBoundingBox(coordinates);
    
    // Only initialize once
    if (!map.current) {
      try {
        // Create map instance with bounds
        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11", // Dark theme looks better
          center: coordinates,
          zoom: 16,
          pitch: 60,
          bearing: 30,
          interactive: true,
          attributionControl: false,
          maxBounds: bounds, // Set max bounds to keep focus on station
          minZoom: 15,      // Prevent zooming out too far
          maxZoom: 19       // Limit max zoom
        });

        // Set up event listeners
        newMap.on('load', () => {
          console.log("Map fully loaded");
          setMapInitialized(true);
          
          // Try to add 3D buildings layer
          try {
            newMap.addLayer({
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 15,
              paint: {
                "fill-extrusion-color": "#aaa", // Gray color for buildings
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.6
              }
            });
            console.log("3D buildings layer added successfully");
          } catch (error) {
            console.warn("Could not add 3D buildings layer:", error);
          }
          
          // Add a marker at the station location
          const el = document.createElement("div");
          el.className = "station-marker";
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#3b82f6";
          el.style.boxShadow = "0 0 10px 2px rgba(59, 130, 246, 0.8)";
          el.style.animation = "pulse 2s infinite";
          
          new mapboxgl.Marker(el)
            .setLngLat(coordinates)
            .addTo(newMap);
          
          // Add initial camera animation
          startEntranceAnimation(newMap);
        });
        
        newMap.on('error', (e) => {
          console.error("Mapbox error:", e);
        });
        
        map.current = newMap;
      } catch (err) {
        console.error("Error initializing Mapbox:", err);
      }
    } else if (mapInitialized) {
      // If map exists and is initialized, just update center
      map.current.setCenter(coordinates);
      map.current.setMaxBounds(bounds);
    }

    return () => {
      // We don't remove the map here
    };
  }, [coordinates, isOpen, mapInitialized]);
  
  // Add entrance animation
  const startEntranceAnimation = (mapInstance: mapboxgl.Map) => {
    const startZoom = mapInstance.getZoom();
    const startBearing = mapInstance.getBearing();
    const startPitch = mapInstance.getPitch();
    
    const targetZoom = Math.min(startZoom + 0.8, 19);
    const targetBearing = 45;
    const targetPitch = 65;
    
    // Animation duration
    const duration = 2000;
    const start = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smoother animation
      const easeProgress = easeInOutCubic(progress);
      
      const newZoom = startZoom + (targetZoom - startZoom) * easeProgress;
      const newBearing = startBearing + (targetBearing - startBearing) * easeProgress;
      const newPitch = startPitch + (targetPitch - startPitch) * easeProgress;
      
      mapInstance.setZoom(newZoom);
      mapInstance.setBearing(newBearing);
      mapInstance.setPitch(newPitch);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  // Easing function
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  
  // Handle resize and cleanup
  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
    
    // Trigger resize after animation completes
    setTimeout(() => {
      if (map.current) {
        console.log("Resizing map after toggle");
        map.current.resize();
      }
    }, 300);
  };

  // Force map resize when visibility changes
  useEffect(() => {
    if (isOpen && map.current) {
      setTimeout(() => {
        if (map.current) {
          console.log("Resizing map after visibility change");
          map.current.resize();
        }
      }, 100);
    }
  }, [isOpen]);

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
          {/* Map container with fallback background */}
          <div 
            ref={mapContainer} 
            className="absolute inset-0 bg-gray-800" 
            style={{ width: '100%', height: '100%' }}
          />

          {/* Loading indicator */}
          {!mapInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* Overlay with controls */}
          <div className="absolute top-2 right-2 flex space-x-2 z-10">
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
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 z-10">
            <div className="text-white text-sm font-medium">{name}</div>
          </div>
          
          {/* Add pulse animation styles */}
          <style jsx>{`
            @keyframes pulse {
              0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
              }
              70% {
                transform: scale(1.2);
                box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapCard;
