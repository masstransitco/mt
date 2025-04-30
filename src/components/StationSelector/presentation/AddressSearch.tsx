"use client";

import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStationSelector } from "../context/StationSelectorContext";
import useGooglePlacesSearch from "../hooks/useGooglePlacesSearch";
import PredictionsDropdown from "./PredictionsDropdown";
import ModalPortal from "@/components/ModalPortal";
import type { StationFeature } from "@/store/stationsSlice";

interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
  selectedStation?: StationFeature | null;
  step?: number;
}

/**
 * Address search input component with Google Places integration
 */
const AddressSearch = React.memo(function AddressSearch({
  onAddressSelect,
  disabled,
  placeholder,
  selectedStation,
}: AddressSearchProps) {
  const { inSheet, currentStep, animateToLocation } = useStationSelector();
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    predictions,
    isDropdownOpen,
    isLoading,
    searchPlaces,
    getLocationFromPrediction,
    setIsDropdownOpen,
    clearPredictions,
    setSelectionInProgress,
    isSelectionInProgress
  } = useGooglePlacesSearch();

  const isStationSelected = !!selectedStation;

  // Clear search text when a station is selected externally (e.g., clicked on map)
  useEffect(() => {
    if (selectedStation && !isSelectionInProgress()) {
      // Only clear if not already in the process of selecting via the dropdown
      setSearchText("");
    }
  }, [selectedStation, isSelectionInProgress]);

  // Handle selection of a prediction
  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    // Mark that a selection is in progress
    setSelectionInProgress(true);

    // Set the text briefly to show what was selected
    setSearchText(prediction.structured_formatting.main_text);

    // Clear predictions and close dropdown
    clearPredictions();

    // Get location from the prediction
    const location = await getLocationFromPrediction(prediction);
    if (location) {
      // Call the callback to trigger station selection (this updates Redux state)
      onAddressSelect(location);
      
      // Use CameraAnimationManager for animation
      import("@/lib/cameraAnimationManager").then(module => {
        const cameraManager = module.default;
        cameraManager.onLocationSearch(location);
      });

      // Clear the search text after a brief delay to allow the user to see what was selected
      setTimeout(() => {
        setSearchText("");
        setSelectionInProgress(false);
      }, 200);
    } else {
      setSelectionInProgress(false);
    }
  };

  // Current step is already available from the earlier useStationSelector call
  
  // Create a style object to handle vertical positioning directly with transform
  const getPositionStyle = () => {
    // In sheet in step 3: move text down precisely by 5px (3.5px + 1.5px)
    if (inSheet && currentStep === 3) {
      return { transform: 'translateY(5px)' };
    }
    
    // In step 2 or step 4 (when not in sheet): move text up by 1.5px
    if (!inSheet && (currentStep === 2 || currentStep === 4)) {
      return { transform: 'translateY(-1.5px)' };
    }
    
    // Default positioning for all other cases
    return {};
  };

  return (
    <div className={cn("station-selector z-99 flex-1", inSheet ? "h-8 min-h-[32px]" : "rounded-xl")}>
      {isStationSelected ? (
        <div
          className={cn(
            "text-foreground font-medium flex items-center",
            "px-3 py-1 text-sm h-full leading-tight w-full",
            inSheet ? "flex items-center justify-start" : "",
          )}
          style={getPositionStyle()} // Apply precise vertical positioning
        >
          {selectedStation!.properties.Place}
        </div>
      ) : (
        <div className={cn("station-selector z-30 relative", "h-full w-full flex items-center")}>
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                searchPlaces(e.target.value);
              }}
              onFocus={() => setIsDropdownOpen(predictions.length > 0)}
              onBlur={() => {
                // small delay so user can click on dropdown
                setTimeout(() => setIsDropdownOpen(false), 150);
              }}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                "apple-input w-full font-medium disabled:cursor-not-allowed transition-colors",
                "text-sm h-full leading-tight py-1 px-3",
                inSheet ? "flex items-center" : "",
                "text-base", // Add this to ensure text is at least 16px
              )}
            />
            {isLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div
                  className={cn(
                    "border-2 border-white/70 border-t-transparent rounded-full animate-spin",
                    inSheet ? "w-3 h-3" : "w-3 h-3",
                  )}
                />
              </div>
            ) : searchText ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setSearchText("");
                  clearPredictions();
                }}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white rounded-full transition-colors",
                  inSheet ? "p-0.5" : "p-0.5",
                )}
                type="button"
              >
                <X className={inSheet ? "w-3 h-3" : "w-3 h-3"} />
              </motion.button>
            ) : null}
          </div>
          <AnimatePresence>
            {isDropdownOpen && predictions.length > 0 && (
              <ModalPortal>
                <PredictionsDropdown 
                  predictions={predictions} 
                  inputRef={inputRef} 
                  onSelect={handleSelect}
                />
              </ModalPortal>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

AddressSearch.displayName = "AddressSearch";

export default AddressSearch;