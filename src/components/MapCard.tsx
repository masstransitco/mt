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

const MAP_PORTAL_ID = 'map-expanded-portal';

const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  address,
  className,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const portalContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const [, setRenderTrigger] = useState(0);

  // Ensure portal div exists and persists
  useEffect(() => {
    // Check if portal already exists first
    let existingPortal = document.getElementById(MAP_PORTAL_ID) as HTMLDivElement | null;
    
    if (existingPortal) {
      portalContainer.current = existingPortal;
    } else if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.id = MAP_PORTAL_ID;
      div.style.position = 'fixed';
      div.style.left = '0';
      div.style.top = '0';
      div.style.width = '100%';
      div.style.height = '100%';
      div.style.zIndex = '10000'; // Higher than Sheet but not interfering with other modals
      div.style.pointerEvents = 'none';
      document.body.appendChild(div);
      portalContainer.current = div;
    }

    // Don't remove the portal container on component unmount
    // This avoids issues when the component re-renders
    return () => {
      // Just clean up our references, don't remove from DOM
      portalContainer.current = null;
    };
  }, []);

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
    const startTime = Date.now();

    const animate = () => {
      if (!marker.current) return;
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;

      // sine wave from 0 -> 1 -> 0
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

  // Cancel marker animation
  const destroyMarkerAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // Initialize or reinitialize the map when needed
  useEffect(() => {
    if (!expanded) return;
    let currentMapContainer = mapContainer.current;
    if (!currentMapContainer) return;

    // Important: Check if we need to clean up an existing map first
    if (map.current) {
      destroyMarkerAnimation();
      map.current.remove();
      map.current = null;
      marker.current = null;
    }

    // Set bounding box for focus
    const bounds = getBoundingBox(coordinates);

    try {
      // Create a new map instance
      map.current = new mapboxgl.Map({
        container: currentMapContainer,
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
        if (!map.current) return;
        
        setMapInitialized(true);

        // Attempt to add 3D buildings
        try {
          if (map.current) {
            map.current.addLayer({
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
          }
        } catch (error) {
          console.warn("Could not add 3D buildings layer:", error);
        }

        // Add a marker
        if (map.current) {
          marker.current = new mapboxgl.Marker({
            color: "#3b82f6",
          })
            .setLngLat(coordinates)
            .addTo(map.current);

          // Kick off marker pulsing
          animateMarker();

          // "Fly in" or "zoom in" effect
          startEntranceAnimation(map.current);
        }
      });

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e);
      });
    } catch (err) {
      console.error("Error initializing Mapbox:", err);
    }

    // Cleanup
    return () => {
      destroyMarkerAnimation();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      marker.current = null;
    };
  }, [coordinates, expanded]); // Re-initialize when coordinates or expanded state changes

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
      if (!mapInstance || !mapInstance.loaded()) return;
      
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

  // Handle escape key for exiting fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) {
        setExpanded(false);
        // Force a render to make sure everything updates
        setRenderTrigger(prev => prev + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  // Expand or minimize with proper event handling
  const toggleExpanded = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setExpanded(prev => !prev);
    
    // Force a render to make sure everything updates
    setTimeout(() => {
      setRenderTrigger(prev => prev + 1);
      if (map.current) {
        map.current.resize();
        // Recenter marker if needed
        if (marker.current) {
          const pos = marker.current.getLngLat();
          marker.current.setLngLat(pos);
        }
      }
    }, 300);
  };
  
  // Make sure map resizes when expanded
  useEffect(() => {
    if (expanded && map.current) {
      const resizeTimer = setTimeout(() => {
        map.current?.resize();
      }, 50);
      
      return () => clearTimeout(resizeTimer);
    }
  }, [expanded]);

  // The card component renders the actual map with all features
  const mapCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching backdrop
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto",
        expanded ? "" : "h-52",
        className
      )}
      style={expanded ? {
        position: 'fixed',
        zIndex: 999999,
        left: '5%',
        right: '5%',
        top: '5%',
        bottom: '5%',
        width: '90%',
        height: '90%',
        margin: '0 auto',
      } : {}}
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
      <div className="absolute top-2 right-2 flex space-x-2 z-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(e);
          }}
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

  // If expanded and we have a portal container, render through portal
  if (expanded) {
    // Try to get the portal container
    const portalEl = portalContainer.current || document.getElementById(MAP_PORTAL_ID);
    
    if (portalEl) {
      return (
        <>
          {/* Render an empty placeholder div in the original position */}
          <div className={cn("h-52", className)} />
          
          {/* Portal the expanded map outside the Sheet component */}
          {createPortal(
            <div 
              className="fixed inset-0 bg-black/50 pointer-events-auto" 
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(e);
              }}
              style={{ 
                backdropFilter: 'blur(2px)',
                zIndex: 999998,
              }}
            >
              {mapCard}
            </div>,
            portalEl
          )}
        </>
      );
    }
  }

  if (!expanded) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto", className)}>
        {/* Simple static snippet content here */}
        <div className="p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
          <div>
            <div className="text-white text-sm font-medium">{name}</div>
            <div className="text-gray-200 text-xs mt-0.5">{address}</div>
          </div>
          <button
            onClick={(e) => toggleExpanded(e)}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
  return mapCard;
};

export default MapCard;
