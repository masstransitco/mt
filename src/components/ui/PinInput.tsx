"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface PinInputProps {
  length: number;
  loading: boolean;
  onChange: (code: string) => void;
}

export default function PinInput({ length, loading, onChange }: PinInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize refs array with the correct length
  useEffect(() => {
    // Initialize an array with the correct length filled with nulls
    inputRefs.current = Array(length).fill(null);
  }, [length]);

  // Focus on first input on mount
  useEffect(() => {
    if (!loading && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [loading]);

  // Reset values when loading state changes
  useEffect(() => {
    if (!loading) {
      setValues(Array(length).fill(""));
      const firstInput = inputRefs.current[0];
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [loading, length]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    // Handle paste
    if (value.length > 1) {
      const pastedValue = value.substring(0, length);
      const newValues = [...Array(length).fill("")];
      
      [...pastedValue].forEach((char, i) => {
        if (i < length) newValues[i] = char;
      });
      
      setValues(newValues);
      onChange(newValues.join(""));

      // Focus on the last input or the next empty one
      const focusIndex = Math.min(pastedValue.length, length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
        setActiveIndex(focusIndex);
      }
      return;
    }

    // Update single value
    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
    onChange(newValues.join(""));

    // Move to next input if current one is filled
    if (value && index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        setActiveIndex(index + 1);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === "Backspace" && !values[index] && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
        setActiveIndex(index - 1);
      }
    }

    // Move to next input on right arrow
    if (e.key === "ArrowRight" && index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        setActiveIndex(index + 1);
      }
    }

    // Move to previous input on left arrow
    if (e.key === "ArrowLeft" && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
        setActiveIndex(index - 1);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();

    // Only accept digits
    if (!/^\d*$/.test(pastedData)) return;

    const pastedValue = pastedData.substring(0, length);
    const newValues = [...Array(length).fill("")];
    
    [...pastedValue].forEach((char, i) => {
      if (i < length) newValues[i] = char;
    });
    
    setValues(newValues);
    onChange(newValues.join(""));

    // Focus on the last input or the next empty one
    const focusIndex = Math.min(pastedValue.length, length - 1);
    const inputToFocus = inputRefs.current[focusIndex];
    if (inputToFocus) {
      inputToFocus.focus();
      setActiveIndex(focusIndex);
    }
  };

  return (
    <div className="flex justify-center space-x-3">
      {Array.from({ length }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
          className="relative"
        >
          <input
            ref={(el) => {
              // Properly set the ref at the specific index
              if (inputRefs.current) {
                inputRefs.current[index] = el;
              }
            }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            disabled={loading}
            value={values[index] || ""}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => setActiveIndex(index)}
            onPaste={handlePaste}
            className="h-14 w-12 rounded-lg border-2 bg-zinc-800 text-center text-xl font-medium text-white caret-[#276EF1] outline-none transition-all focus:border-[#276EF1] disabled:opacity-50 sm:h-16 sm:w-14"
            style={{
              borderColor: activeIndex === index ? "#276EF1" : "rgb(39, 39, 42)",
            }}
          />
          {activeIndex === index && (
            <motion.div
              layoutId="active-indicator"
              className="absolute -bottom-1 left-0 right-0 mx-auto h-0.5 w-8 rounded-full bg-[#276EF1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}