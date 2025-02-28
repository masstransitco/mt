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

  // Use a simpler style for better compatibility
  const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

  // Initialize the map when component mounts
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;
    
    console.log("Initializing map with coordinates:", coordinates);
    
    // Only initialize once
    if (!map.current) {
      try {
        // Create a simpler map instance with fewer custom options
        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: MAPBOX_STYLE,
          center: coordinates,
          zoom: 16,
          pitch: 60,
          bearing: 30,
          interactive: true,
          attributionControl: false,
        });

        // Set up event listeners
        newMap.on('load', () => {
          console.log("Map fully loaded");
          setMapInitialized(true);
          
          // Add a marker at the station location
          new mapboxgl.Marker({
            color: "#3b82f6"
          })
            .setLngLat(coordinates)
            .addTo(newMap);
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
    }

    return () => {
      // We don't remove the map here
    };
  }, [coordinates, isOpen, mapInitialized]);
  
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapCard;
