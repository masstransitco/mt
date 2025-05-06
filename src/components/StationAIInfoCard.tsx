"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Minimize2, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StationFeature } from "@/store/stationsSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { 
  fetchStationInfo, 
  setActiveStation,
  selectStationAiLoading
} from "@/store/stationAiSlice";
import StationInfoCard from "./StationInfoCard";

const AI_INFO_PORTAL_ID = "station-ai-info-portal";

interface StationAIInfoCardProps {
  station: StationFeature;
  expanded?: boolean;
  onToggleExpanded?: (newVal: boolean) => void;
  hideDefaultExpandButton?: boolean;
  className?: string;
}

const StationAIInfoCard: React.FC<StationAIInfoCardProps> = ({
  station,
  expanded: externalExpanded,
  onToggleExpanded,
  hideDefaultExpandButton = false,
  className,
}) => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectStationAiLoading);
  
  // Local expansion state
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = typeof externalExpanded === "boolean" ? externalExpanded : localExpanded;
  
  // Portal container reference
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Keep local expansion in sync with external
  useEffect(() => {
    if (typeof externalExpanded === "boolean") {
      setLocalExpanded(externalExpanded);
    }
  }, [externalExpanded]);
  
  // Create a dedicated portal container if needed
  useEffect(() => {
    let container = document.getElementById(AI_INFO_PORTAL_ID) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = AI_INFO_PORTAL_ID;
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
      
      // Set active station in Redux when expanded for AI info
      if (!isExpanded) {
        dispatch(setActiveStation(station.id));
        // Preload AI information
        dispatch(fetchStationInfo({ station }));
      } else {
        dispatch(setActiveStation(null));
      }
      
      if (onToggleExpanded) {
        onToggleExpanded(!isExpanded);
      } else {
        setLocalExpanded(!isExpanded);
      }
    },
    [isExpanded, onToggleExpanded, dispatch, station]
  );
  
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
  const aiInfoCard = (
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
      {/* Card content */}
      <div className="absolute inset-0 flex flex-col">
        {/* Title bar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
          <div>
            <h3 className="text-white font-medium">{station.properties?.Place} - AI Info</h3>
            <p className="text-xs text-gray-400">{station.properties?.Address}</p>
          </div>
          
          <button
            onClick={toggleExpanded}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            aria-label={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          {isExpanded && <StationInfoCard station={station} />}
        </div>
      </div>
      
      {/* Preview content (only visible when not expanded) */}
      {!isExpanded && (
        <div className="absolute inset-0 p-3 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white text-sm font-medium">{station.properties?.name}</h3>
              <p className="text-gray-400 text-xs">{station.properties?.address}</p>
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
          
          {/* Preview content */}
          <div className="mt-2 flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Click to view AI-powered information</p>
              <p className="text-gray-500 text-xs mt-1">Weather, traffic, dining, and more</p>
            </div>
          </div>
        </div>
      )}
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
            {aiInfoCard}
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
          <div className="text-white text-sm font-medium">{station.properties?.name} - AI Info</div>
          <div className="text-gray-200 text-xs mt-0.5">{station.properties?.address}</div>
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

export default StationAIInfoCard;