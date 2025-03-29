"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP_PORTAL_ID = "google-3d-map-portal";

interface Google3DMapCardProps {
  coordinates: [number, number]; // [lng, lat]
  name: string;
  address: string;
  className?: string;
  expanded?: boolean;
  onToggleExpanded?: (newVal: boolean) => void;
  hideDefaultExpandButton?: boolean;
}

export const Google3DMapCard: React.FC<Google3DMapCardProps> = ({
  coordinates,
  name,
  address,
  className,
  expanded: externalExpanded,
  onToggleExpanded,
  hideDefaultExpandButton = false,
}) => {
  const [localExpanded, setLocalExpanded] = useState(false);
  const [isMaps3DReady, setIsMaps3DReady] = useState(false);

  const isExpanded =
    typeof externalExpanded === "boolean" ? externalExpanded : localExpanded;

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  // Keep local expansion in sync with external
  useEffect(() => {
    if (typeof externalExpanded === "boolean") {
      setLocalExpanded(externalExpanded);
    }
  }, [externalExpanded]);

  // Check if <gmp-map-3d> is loaded (script must be loaded globally!)
  useEffect(() => {
    // If google.maps.maps3d is defined, we can create <gmp-map-3d>.
    if (typeof window !== "undefined" && window.google?.maps?.maps3d) {
      setIsMaps3DReady(true);
    } else {
      setIsMaps3DReady(false);
    }
  }, []);

  // Create a dedicated portal container if needed
  useEffect(() => {
    let container = document.getElementById(MAP_PORTAL_ID) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = MAP_PORTAL_ID;
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "9999";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);
    }
    portalContainerRef.current = container;
  }, []);

  // Expand/collapse logic
  const toggleExpanded = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      if (onToggleExpanded) {
        onToggleExpanded(!isExpanded);
      } else {
        setLocalExpanded((prev) => !prev);
      }
    },
    [isExpanded, onToggleExpanded]
  );

  // When expanded and 3D is ready, mount the <gmp-map-3d>
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !isExpanded || !isMaps3DReady) return;

    // Clean up from prior expansions
    container.innerHTML = "";

    // Create the 3D map custom element
    const mapEl = document.createElement("gmp-map-3d");
    mapEl.setAttribute("mode", "hybrid");

    // Google wants center="lat,lng" (not [lng, lat])
    const [lng, lat] = coordinates;
    mapEl.setAttribute("center", `${lat},${lng}`);

    mapEl.setAttribute("tilt", "70");
    mapEl.setAttribute("heading", "20");
    mapEl.setAttribute("range", "2000");

    mapEl.style.display = "block";
    mapEl.style.width = "100%";
    mapEl.style.height = "100%";

    container.appendChild(mapEl);

    return () => {
      container.innerHTML = "";
    };
  }, [isExpanded, isMaps3DReady, coordinates]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        toggleExpanded();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, toggleExpanded]);

  // The main card structure
  const mapCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto bg-black",
        !isExpanded && "h-52",
        className
      )}
      style={
        isExpanded
          ? {
              position: "fixed",
              zIndex: 99999,
              left: "5%",
              right: "5%",
              top: "5%",
              bottom: "5%",
              width: "90%",
              height: "90%",
              margin: "0 auto",
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={mapContainerRef}
        className="absolute inset-0 bg-gray-900"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Expand/Collapse button */}
      {!hideDefaultExpandButton && (
        <div className="absolute top-2 right-2 z-50">
          <button
            onClick={toggleExpanded}
            className="bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            aria-label={isExpanded ? "Minimize map" : "Maximize map"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}
      {/* Station Info Overlay */}
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

  // If expanded, put it in the portal
  if (isExpanded && portalContainerRef.current) {
    return (
      <>
        {/* Optional placeholder so layout doesn't collapse */}
        <div className={cn("h-52", className)} />
        {createPortal(
          <div
            className="fixed inset-0 bg-black/50 pointer-events-auto"
            style={{ backdropFilter: "blur(2px)", zIndex: 99998 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(e);
            }}
          >
            {mapCard}
          </div>,
          portalContainerRef.current
        )}
      </>
    );
  }

  // Otherwise, render the small static card
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto bg-black",
        "h-52",
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
            onClick={toggleExpanded}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Google3DMapCard;