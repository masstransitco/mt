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
  
  // Initialize and set up map when component mounts or when coordinates change
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;
    
    console.log("Initializing map with coordinates:", coordinates);
    
    // Initialize map only if it doesn't exist yet
    if (!map.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11", // Dark theme
          center: coordinates,
          zoom: 17,
          pitch: 45,
          bearing: 0,
          attributionControl: false,
        });

        // Add basic navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
        
        // Add a marker at the station location
        new mapboxgl.Marker({
          color: "#3b82f6" // Blue color matching the app theme
        })
          .setLngLat(coordinates)
          .addTo(map.current);
        
        // Log when map loads and style loads
        map.current.on('load', () => {
          console.log("Map loaded successfully");
          
          // Simple 3D buildings layer with default settings
          if (map.current) {
            map.current.addLayer({
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 15,
              paint: {
                "fill-extrusion-color": "#aaa",
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.6
              }
            });
          }
        });
        
        // Handle potential style load errors
        map.current.on('style.load', () => {
          console.log("Style loaded successfully");
        });
        
        // Log any errors
        map.current.on('error', (e) => {
          console.error("Mapbox error:", e);
        });
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    } else {
      // If map exists, just update the center
      map.current.setCenter(coordinates);
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
        console.log("Removing map instance");
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
    
    // Resize the map after toggle to ensure it renders correctly
    if (map.current) {
      setTimeout(() => {
        map.current?.resize();
        console.log("Map resized after expand/collapse");
      }, 300);
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
          <div 
            ref={mapContainer} 
            className="absolute inset-0" 
            style={{ backgroundColor: "#1f2937" }} // Fallback background color
          />

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
