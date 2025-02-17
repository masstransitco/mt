"use client";

import React, { useState } from "react";
import { KeySquare, X } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import ReactPlayer (client-side only), disable SSR
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
  const [playing, setPlaying] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        className="
          relative
          w-4/5
          max-w-2xl
          bg-gray-50/90
          backdrop-blur-sm
          shadow-2xl
          rounded-lg
          overflow-hidden
        "
        style={{ maxHeight: "80vh" }}
      >
        {/* Close button (absolute) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video section: no padding, flush with top */}
        <div className="relative w-full">
          <ReactPlayer
            url="/brand/departinfo.mp4"
            playing={playing}
            loop={false}            // Play once only
            muted={true}            // Needed for most browsers to auto-play
            controls={false}        // Hide controls
            pip={false}             // Disable picture-in-picture
            width="100%"
            height="100%"
            config={{
              file: { attributes: { playsInline: true } },
            }}
            onEnded={() => setPlaying(false)}   // Stop once finished
            onClick={() => setPlaying(true)}    // Replay on click
            style={{ cursor: "pointer" }}
          />

          {/* Gradient overlay to transition video -> gray background */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-gray-50/90" />
        </div>

        {/* Scrollable content area with padding for text/icons */}
        <div className="overflow-y-auto p-4">
          {/* Icons + descriptions */}
          <div className="space-y-4 text-sm">
            <div className="flex items-start space-x-2">
              {/* Inline Parking SVG with light gray color */}
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
                className="lucide lucide-circle-parking w-5 h-5 text-gray-400"
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

            <div className="flex items-start space-x-2">
              <KeySquare className="w-5 h-5 text-gray-400" />
              <p>
                <strong>Immediate dispatch of vehicles</strong> to your selected
                departure station with a self-serve digital key.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
