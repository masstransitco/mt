"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface PredictionsDropdownProps {
  predictions: google.maps.places.AutocompletePrediction[];
  inputRef: React.RefObject<HTMLInputElement>;
  onSelect: (prediction: google.maps.places.AutocompletePrediction) => void;
}

/**
 * Dropdown component for showing search predictions
 */
const PredictionsDropdown = React.memo(({ predictions, inputRef, onSelect }: PredictionsDropdownProps) => {
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  // Calculate position based on input element
  useEffect(() => {
    if (!inputRef.current) return;

    // Initial position calculation
    const calculatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();

        // Position below the input
        setDropdownPosition({
          top: rect.bottom + 5, // Position slightly below the input
          left: rect.left,
          width: rect.width,
        });
      }
    };

    // Calculate position immediately
    calculatePosition();

    // Recalculate on resize or scroll
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition);
    };
  }, [inputRef]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        // Click was outside the dropdown and input
        // We don't need to handle closing here as the input's onBlur does that
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputRef]);

  // Prevent clicks from bubbling to avoid closing the dropdown
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "fixed",
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 9999,
        transformOrigin: "top",
      }}
      className="apple-container max-h-60 overflow-y-auto shadow-xl"
    >
      {predictions.map((prediction) => (
        <motion.button
          key={prediction.place_id}
          whileHover={{ backgroundColor: "rgba(30,30,30,0.5)" }}
          onMouseDown={handleMouseDown}
          onClick={() => onSelect(prediction)}
          className="w-full px-2.5 py-1 text-left text-sm text-foreground transition-colors border-b border-border/50 last:border-b-0"
          type="button"
        >
          <div className="font-medium">{prediction.structured_formatting.main_text}</div>
          <div className="text-xs text-gray-400">{prediction.structured_formatting.secondary_text}</div>
        </motion.button>
      ))}
    </motion.div>
  );
});

PredictionsDropdown.displayName = "PredictionsDropdown";

export default PredictionsDropdown;