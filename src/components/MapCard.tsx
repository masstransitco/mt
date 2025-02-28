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
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [lastCoordinates, setLastCoordinates] = useState<[number, number]>(coordinates);
  const [wasOpen, setWasOpen] = useState(false);

  // Set appropriate bounds around the station location
  const getBoundingBox = (center: [number, number], radiusKm: number = 0.25) => {
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

  // Subtle marker animation
  const animateMarker = () => {
    if (!marker.current) return;
    
    const markerEl = marker.current.getElement();
    const scaleFactor = 1.1; // Subtle scale increase
    
    // Animation duration and timing
    const duration = 1500;
    const start = Date.now();
    
    // Store original transformation to prevent loss after animation cycles
    let frameId: number | null = null;
    
    const animate = () => {
      if (!marker.current) return;
      
      const elapsed = Date.now() - start;
      const progress = (elapsed % duration) / duration;
      
      // Simple sine wave for smooth pulsing (0 to 1 to 0)
      const scale = 1 + (Math.sin(progress * Math.PI * 2) * 0.5 + 0.5) * (scaleFactor - 1);
      
      // Get the marker element again in case it was recreated
      const currentEl = marker.current.getElement();
      
      // Get the current transform that maintains position
      const currentTransform = currentEl.style.transform || '';
      
      // Extract scale if already present
      const scaleMatch = currentTransform.match(/scale\([0-9.]+\)/);
      
      // Replace existing scale or add new scale
      const newTransform = scaleMatch 
        ? currentTransform.replace(scaleMatch[0], `scale(${scale})`)
        : `${currentTransform} scale(${scale})`;
      
      // Apply the transform
      currentEl.style.transform = newTransform;
      
      // Continue animation as long as marker exists
      frameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    frameId = requestAnimationFrame(animate);
    
    // Return cleanup function
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  };

  // Track when isOpen changes to handle re-opening
  useEffect(() => {
    if (isOpen && !wasOpen) {
      // Force re-initialization if we're reopening
      if (map.current && !coordsEqual(coordinates, lastCoordinates)) {
        // If coordinates changed, update them
        setLastCoordinates(coordinates);
        map.current.setCenter(coordinates);
        
        if (marker.current) {
          marker.current.setLngLat(coordinates);
        }
      }
      
      // If map exists, make sure it's visible and properly sized
      if (map.current) {
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 100);
      }
    }
    
    setWasOpen(isOpen);
  }, [isOpen, coordinates, lastCoordinates, wasOpen]);

  // Helper to compare coordinates
  const coordsEqual = (a: [number, number], b: [number, number]): boolean => {
    return a[0] === b[0] && a[1] === b[1];
  };

  // Initialize the map when component mounts
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;
    
    console.log("Initializing map with coordinates:", coordinates);
    setLastCoordinates(coordinates);
    
    // Calculate bounds for the map
    const bounds = getBoundingBox(coordinates);
    
    // Only initialize once
    if (!map.current) {
      try {
        // Create map instance with bounds and reduced initial zoom
        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11", // Dark theme looks better
          center: coordinates,
          zoom: 12.5, // Starting further away
          pitch: 40, // Lower initial pitch
          bearing: 0, // Initial bearing
          interactive: true, // Allow user interaction
          attributionControl: false,
          maxBounds: bounds, // Set max bounds to keep focus on station
          minZoom: 11,      // Prevent zooming out too far
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
              minzoom: 14,
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
          
          // Add a blue marker at the station location
          marker.current = new mapboxgl.Marker({
            color: "#3b82f6", // Blue color matching the app theme
          })
            .setLngLat(coordinates)
            .addTo(newMap);
          
          // Start marker animation
          const stopAnimation = animateMarker();
          
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
      // If map exists and is initialized, just update center and marker
      map.current.setCenter(coordinates);
      map.current.setMaxBounds(bounds);
      
      // Update marker position
      if (marker.current) {
        marker.current.setLngLat(coordinates);
      }
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
    
    const targetZoom = 16.5; // Closer but not too close
    const targetBearing = 45; // Final bearing
    const targetPitch = 65;   // Final pitch
    
    // Animation duration
    const duration = 2500; // A bit longer for a smoother animation
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
      marker.current = null;
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
        
        // When resizing, make sure marker is properly updated
        if (marker.current) {
          const currentPos = marker.current.getLngLat();
          marker.current.setLngLat(currentPos);
        }
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
          
          // Ensure marker is correctly positioned after resize
          if (marker.current) {
            const currentPos = marker.current.getLngLat();
            marker.current.setLngLat(currentPos);
          }
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

          {/* Location name overlay with enhanced contrast */}
          <div 
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)',
              paddingTop: '40px',
              paddingBottom: '14px',
              paddingLeft: '12px',
              paddingRight: '12px'
            }}
          >
            <div className="text-white text-sm font-medium">{name}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapCard;
