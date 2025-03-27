"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback
} from "react";
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

  // NEW/CHANGED: external expand control
  expanded?: boolean;
  onToggleExpanded?: (newVal: boolean) => void;

  // NEW/CHANGED: hide the default expand button in the card
  hideDefaultExpandButton?: boolean;
}

const MAP_PORTAL_ID = "map-expanded-portal";

const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  address,
  className,
  // NEW/CHANGED:
  expanded: externalExpanded,
  onToggleExpanded,
  hideDefaultExpandButton = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const portalContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // If the parent is controlling expansion, default to that. Otherwise, use our own local state
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded =
    typeof externalExpanded === "boolean" ? externalExpanded : localExpanded;

  const [mapInitialized, setMapInitialized] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const [, setRenderTrigger] = useState(0);

  // If parent's externalExpanded changes, keep our local state in sync
  useEffect(() => {
    if (typeof externalExpanded === "boolean") {
      setLocalExpanded(externalExpanded);
    }
  }, [externalExpanded]);

  // NEW: A function that toggles expansion
  const toggleExpanded = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      // If the parent provided a callback, call it with the new value
      if (onToggleExpanded) {
        onToggleExpanded(!isExpanded);
      } else {
        setLocalExpanded((prev) => !prev);
      }

      // Force a render re-check
      setTimeout(() => {
        setRenderTrigger((prev) => prev + 1);
        if (map.current) {
          map.current.resize();
        }
      }, 300);
    },
    [isExpanded, onToggleExpanded]
  );

  // Ensure portal div exists and persists
  useEffect(() => {
    let existingPortal = document.getElementById(MAP_PORTAL_ID) as HTMLDivElement | null;

    if (existingPortal) {
      portalContainer.current = existingPortal;
    } else if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.id = MAP_PORTAL_ID;
      div.style.position = "fixed";
      div.style.left = "0";
      div.style.top = "0";
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.zIndex = "10000";
      div.style.pointerEvents = "none";
      document.body.appendChild(div);
      portalContainer.current = div;
    }

    return () => {
      // we do NOT remove the portal from the DOM here,
      // so it can be reused if MapCard remounts
      portalContainer.current = null;
    };
  }, []);

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
      const scale =
        1 +
        (Math.sin(progress * Math.PI * 2) * 0.5 + 0.5) * (scaleFactor - 1);

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

  const destroyMarkerAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // (Re)initialize the map whenever expanded is true
  useEffect(() => {
    if (!isExpanded) return;
    let currentMapContainer = mapContainer.current;
    if (!currentMapContainer) return;

    // Clean up any existing map
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

          // Start marker pulsing
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

    return () => {
      destroyMarkerAnimation();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      marker.current = null;
    };
  }, [coordinates, isExpanded]);

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
      const newBearing =
        startBearing + (targetBearing - startBearing) * easeProgress;
      const newPitch =
        startPitch + (targetPitch - startPitch) * easeProgress;

      mapInstance.setZoom(newZoom);
      mapInstance.setBearing(newBearing);
      mapInstance.setPitch(newPitch);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  const easeInOutCubic = (t: number): number => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        toggleExpanded();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, toggleExpanded]);

  useEffect(() => {
    if (isExpanded && map.current) {
      const resizeTimer = setTimeout(() => {
        map.current?.resize();
      }, 50);
      return () => clearTimeout(resizeTimer);
    }
  }, [isExpanded]);

  // The card in expanded mode
  const mapCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto",
        isExpanded ? "" : "h-52",
        className
      )}
      style={
        isExpanded
          ? {
              position: "fixed",
              zIndex: 999999,
              left: "5%",
              right: "5%",
              top: "5%",
              bottom: "5%",
              width: "90%",
              height: "90%",
              margin: "0 auto",
            }
          : {}
      }
    >
      <div
        ref={mapContainer}
        className="absolute inset-0 bg-gray-800"
        style={{ width: "100%", height: "100%" }}
      />

      {!mapInitialized && isExpanded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* NEW/CHANGED: only show the built-in expand button if hideDefaultExpandButton is false */}
      {!hideDefaultExpandButton && (
        <div className="absolute top-2 right-2 flex space-x-2 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(e);
            }}
            className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            aria-label={isExpanded ? "Minimize map" : "Maximize map"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 z-10 p-3"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)"
        }}
      >
        <div className="text-white text-sm font-medium">{name}</div>
        <div className="text-gray-200 text-xs mt-0.5">{address}</div>
      </div>
    </motion.div>
  );

  // If expanded, render through the portal
  if (isExpanded) {
    const portalEl =
      portalContainer.current ||
      document.getElementById(MAP_PORTAL_ID);

    if (portalEl) {
      return (
        <>
          {/* placeholder in the original layout */}
          <div className={cn("h-52", className)} />

          {createPortal(
            <div
              className="fixed inset-0 bg-black/50 pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(e);
              }}
              style={{
                backdropFilter: "blur(2px)",
                zIndex: 999998
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

  // Not expanded => show small snippet
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto",
        className
      )}
    >
      <div className="p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <div>
          <div className="text-white text-sm font-medium">{name}</div>
          <div className="text-gray-200 text-xs mt-0.5">{address}</div>
        </div>
        {/* If we're hiding the default expand button, don't show it. */}
        {!hideDefaultExpandButton && (
          <button
            onClick={(e) => toggleExpanded(e)}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MapCard;