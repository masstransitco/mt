"use client";

import React from "react";
import { KeySquare, X } from "lucide-react";
// import ReactPlayer from "react-player"; <-- dynamic import if using Next.js SSR
import dynamic from "next/dynamic";

// Dynamically import ReactPlayer (client-side only), disable SSR
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    // Backdrop & container
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card: 80% viewport width, rounded, centered */}
      <div
        className="relative w-4/5 max-w-2xl bg-white rounded-xl p-4 shadow-lg"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="mb-2 text-xl font-semibold">Departure Info</h2>

        {/* ReactPlayer for the video */}
        <div className="mb-4 aspect-w-16 aspect-h-9">
          <ReactPlayer
            url="/brand/departinfo.mp4"
            playing
            loop
            controls
            width="100%"
            height="100%"
          />
        </div>

        {/* Icon + description list */}
        <div className="space-y-4 text-sm">
          {/* 1) Custom Parking Icon (inline SVG) */}
          <div className="flex items-start space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-circle-parking w-5 h-5 text-blue-600"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
            </svg>
            <p>
              <strong>Pick up and return the car</strong> at the selected
              station&apos;s carpark. Our fares are inclusive of all parking
              costs.
            </p>
          </div>

          {/* 2) KeySquare icon from lucide-react */}
          <div className="flex items-start space-x-2">
            <KeySquare className="w-5 h-5 text-blue-600" />
            <p>
              <strong>Immediate dispatch of vehicles</strong> to your selected
              departure station with a self-serve digital key.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
