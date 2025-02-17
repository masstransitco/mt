"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { KeySquare, X } from "lucide-react";

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

      {/* Modal container with margins for full shadow visibility */}
      <div
        className="
          relative
          w-11/12
          max-w-2xl
          mx-4
          my-4
          bg-gray-200/90
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
          className="absolute top-3 right-3 p-1 rounded-full bg-gray-800 hover:bg-gray-700 z-10"
          aria-label="Close modal"
        >
          {/* Also scale up on larger screens */}
          <X className="w-6 h-6 text-white sm:w-7 sm:h-7 md:w-8 md:h-8" />
        </button>

        {/* Video section: no padding, flush with top */}
        <div className="relative w-full">
          <ReactPlayer
            url="/brand/departinfo.mp4"
            playing={playing}
            loop={false}            
            muted={true}            
            controls={false}        
            pip={false}             
            width="100%"
            height="100%"
            config={{
              file: {
                attributes: {
                  playsInline: true,
                },
              },
            }}
            onEnded={() => setPlaying(false)}   
            onClick={() => setPlaying(true)}    
            style={{ cursor: "pointer" }}
          />

          {/* Gradient overlay for smooth transition to bg-gray-200/90 */}
          <div className="
            pointer-events-none
            absolute
            bottom-0
            left-0
            right-0
            h-24
            bg-gradient-to-b
            from-transparent
            to-[rgba(229,231,235,0.9)]
          " />
        </div>

        {/* Scrollable content area with padding for text/icons */}
        <div className="overflow-y-auto p-4 text-gray-900 text-sm space-y-4">
          {/* 1) Parking icon + description */}
          <div className="flex items-start space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              // Scales up from w-6/h-6 to w-7/h-7 at sm, w-8/h-8 at md
              className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-900"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
            </svg>
            <p>
              <strong>Pick up or return at any station</strong>, with all parking costs included—no surprises.
            </p>
          </div>

          {/* 2) KeySquare icon + description */}
          <div className="flex items-start space-x-2">
            <KeySquare className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-900" />
            <p>
              <strong>Arrive to a ready car</strong>, unlock with our digital key, and drive instantly.
            </p>
          </div>

          {/* 3) ShieldCheck icon + description */}
          <div className="flex items-start space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              className="
                w-6 h-6
                sm:w-7 sm:h-7
                md:w-8 md:h-8
                text-gray-900
                scale-105 origin-center
              "
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
              <path d="m9 12 2 2 4-4" />
            </svg>
            <p>
              <strong>Enjoy comprehensive coverage</strong> under Hong Kong’s Third Party Risks, ensuring a worry-free journey.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
