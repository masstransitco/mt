"use client";

import React from "react";
import { motion } from "framer-motion";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-2 py-2">
      {Array.from({ length: totalSteps }, (_, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{
            scale: index + 1 === currentStep ? 1.1 : 1,
            opacity: 1
          }}
          transition={{ duration: 0.3 }}
          className={`h-2 w-2 rounded-full ${
            index + 1 === currentStep ? "bg-[#276EF1]" : "bg-zinc-600"
          }`}
        />
      ))}
    </div>
  );
}