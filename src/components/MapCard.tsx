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

  // External expand control (optional)
  expanded?: boolean;
  onToggleExpanded?: (newVal: boolean) => void;

  // Hide the default expand button
  hideDefaultExpandButton?: boolean;
}

const MAP_PORTAL_ID = "map-expanded-portal";

const MapCard: React.FC<MapCardProps> = ({
  coordinates,
  name,
  address,
  className,
  expanded: externalExpanded,
  onToggleExpanded,
  hideDefaultExpandButton = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const portalContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Local expand state if parent is not controlling expansion
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded =
    typeof externalExpanded === "boolean" ? externalExpanded : localExpanded;

  const [mapInitialized, setMapInitialized] = useState(false);
  const [, setRenderTrigger] = useState(0);

  // Keep local state in sync if external prop changes
  useEffect(() => {
    if (typeof externalExpanded === "boolean") {
      setLocalExpanded(externalExpanded);
    }
  }, [externalExpanded]);

  const toggleExpanded = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (onToggleExpanded) {
        onToggleExpanded(!isExpanded);
      } else {
        setLocalExpanded((prev) => !prev);
      }

      // Force a map resize after the animation
      setTimeout(() => {
        setRenderTrigger((prev) => prev + 1);
        if (map.current) {
          map.current.resize();
        }
      }, 300);
    },
    [isExpanded, onToggleExpanded]
  );

  // Ensure a portal div exists in the DOM (for expanded mode)
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
      // Keep the portal for reuse
      portalContainer.current = null;
    };
  }, []);

  // Helper to get a bounding box near the point
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

  // Smooth zoom/pitch/bearing entrance
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
      // If map is destroyed or no longer loaded, skip
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

  // Initialize the map only when expanded
  useEffect(() => {
    if (!isExpanded) return;
    const currentMapContainer = mapContainer.current;
    if (!currentMapContainer) return;

    // Clean up any existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

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
        maxZoom: 19
      });

      // Use optional chaining or a null check:
      map.current?.on("load", () => {
        if (!map.current) return; // <-- TS now knows map.current isn't null
        setMapInitialized(true);

        // Add a base 3D buildings layer
        try {
          map.current.addLayer({
            id: "3d-buildings-base",
            source: "composite",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#aaa",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.6
            }
          });
        } catch (error) {
          console.warn("Could not add 3D buildings layer:", error);
        }

        // 1) Convert lng/lat to screen coordinates for query
        const pixelPoint = map.current.project(coordinates);

        // 2) Query buildings at that screen coordinate
        const buildingFeatures = map.current.queryRenderedFeatures(pixelPoint, {
          layers: ["3d-buildings-base"]
        });

        if (buildingFeatures && buildingFeatures.length > 0) {
          const buildingFeature = buildingFeatures[0];
          // 3) Add a highlight fill-extrusion for just this building
          try {
            map.current.addLayer(
              {
                id: "highlighted-building",
                type: "fill-extrusion",
                source: "composite",
                "source-layer": "building",
                filter: ["==", ["id"], buildingFeature.id],
                paint: {
                  "fill-extrusion-color": "#3b82f6", // your highlight color
                  "fill-extrusion-height": ["get", "height"],
                  "fill-extrusion-base": ["get", "min_height"],
                  "fill-extrusion-opacity": 0.9
                }
              },
              "3d-buildings-base"
            );
          } catch (err) {
            console.warn("Error adding highlight layer:", err);
          }
        }

        // Fly/zoom in effect
        startEntranceAnimation(map.current);
      });

      map.current?.on("error", (e) => {
        console.error("Mapbox error:", e);
      });
    } catch (err) {
      console.error("Error initializing Mapbox:", err);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [coordinates, isExpanded]);

  // Resize map on window resize
  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close expanded mode on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        toggleExpanded();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, toggleExpanded]);

  // Force map resize if re-rendered while expanded
  useEffect(() => {
    if (isExpanded && map.current) {
      const resizeTimer = setTimeout(() => {
        map.current?.resize();
      }, 50);
      return () => clearTimeout(resizeTimer);
    }
  }, [isExpanded]);

  // The main map card element
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
              margin: "0 auto"
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

      {/* Built-in expand/minimize button (unless hidden) */}
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

  // If expanded, render into the portal to take up the screen
  if (isExpanded) {
    const portalEl =
      portalContainer.current || document.getElementById(MAP_PORTAL_ID);

    if (portalEl) {
      return (
        <>
          {/* Placeholder in the original layout */}
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

  // If not expanded, show the smaller snippet
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