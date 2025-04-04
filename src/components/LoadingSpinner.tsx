"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { LogoSvg } from "@/components/ui/logo/LogoSvg"

interface LoadingSpinnerProps {
  progress?: number;
  message?: string;
}

export const LoadingSpinner = ({ progress, message }: LoadingSpinnerProps) => {
  const loadingPhrases = [
    "Locating nearby vehicles",
    "Mapping optimal routes",
    "Checking station availability",
    "Preparing your journey",
  ]

  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % loadingPhrases.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background">
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Pulsing circle behind logo */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/10"
            initial={{ scale: 0.5, opacity: 0.5 }}
            animate={{
              scale: [0.5, 1.5, 0.5],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />

          {/* Animated Logo SVG */}
          <motion.div 
            className="relative z-10 w-24 h-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <LogoSvg
              className="w-full h-full text-primary"
            />

            {/* Path animation overlay */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.5, delay: 1 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2100 950" className="w-full h-full">
                <motion.path
                  d="M1221.62 684.48V108.15c0-4.69-3.8-8.49-8.49-8.49H1109.7c-4.69 0-8.49 3.8-8.49 8.49v116.13c0 35.81-29.02 64.83-64.83 64.83H792.12c-.97 0-1.93-.17-2.85-.5-23.3-8.32-49.3-12.73-77.51-12.73-79.91 0-143.64 31.44-185.78 88.91-3.58 4.89-10.95 4.59-14.11-.57-33.84-55.37-94.35-88.34-171.81-88.34-62.91 0-115.68 21.15-155.29 60.44-5.35 5.3-14.45 1.5-14.45-6.04v-25.02c0-4.69-3.8-8.49-8.49-8.49H58.49c-4.69 0-8.49 3.8-8.49 8.49v522.9c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V518.67c0-76.27 52.64-126.76 129.98-126.76 74.13 0 121.39 49.41 121.39 124.61v311.64c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V518.67c0-76.27 52.64-126.76 129.99-126.76 74.13 0 121.39 49.41 121.39 124.61v311.64c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V481.07c0-30.34-4.86-58.14-13.99-82.84-2.06-5.58 2.04-11.5 7.98-11.48l185.04.8a8.48 8.48 0 0 1 8.45 8.49v335.72c0 56.03 55.08 101.74 111.09 102.82 89.54 1.72 176.62 3.21 203.35-.51 4.2-.59 7.33-4.16 7.33-8.41v-81.63c0-4.69-3.8-8.49-8.49-8.49h-141.81c-28.18 0-51.04-22.86-51.04-51.06z M1934.77 633.74c-23.43 66.53-87.65 109.51-163.59 109.51-49.34 0-94.79-18.38-127.97-51.76-33.27-33.47-51.59-79.41-51.59-129.37 0-49.96 18.32-95.91 51.59-129.37 33.18-33.38 78.63-51.76 127.97-51.76 75.94 0 140.16 42.98 163.59 109.51 1.2 3.4 4.4 5.67 8.01 5.67h98.73c5.43 0 9.47-5.03 8.29-10.33-6.79-30.55-18.76-59.28-35.56-85.41-16.52-25.67-37.34-48.24-61.87-67.08-24.69-18.96-52.55-33.7-82.81-43.79-31.14-10.39-64.23-15.65-98.36-15.65-33.28 0-65.5 5.04-95.68 14.73-.83.27-1.7.41-2.57.41h-416.57c-4.69 0-8.49 3.8-8.49 8.49v82.84c0 4.69 3.8 8.49 8.49 8.49h261.67c6.75 0 10.81 7.5 7.11 13.12-30.5 46.37-46.87 101.56-46.87 160.14 0 79.19 29.91 152.19 84.22 205.57 54.23 53.3 128.36 82.65 208.69 82.65 34.13 0 67.23-5.27 98.36-15.65 30.27-10.1 58.12-24.83 82.81-43.79 24.54-18.85 45.36-41.42 61.87-67.08 16.81-26.12 28.77-54.85 35.56-85.4 1.18-5.3-2.86-10.33-8.28-10.33h-98.73c-3.61-.03-6.82 2.25-8.02 5.64z"
                  stroke="#ffffff"
                  strokeWidth="8"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
              </svg>
            </motion.div>
          </motion.div>
        </div>

        {/* Animated car moving across a line */}
        <div className="w-48 relative">
          <div className="h-px w-full bg-muted-foreground/30 my-6" />
          <motion.div
            initial={{ x: -50 }}
            animate={{ x: 150 }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              ease: "easeInOut",
            }}
            className="absolute top-1/2 -translate-y-1/2"
          >
            {/* Custom car SVG with color that can be controlled */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlSpace="preserve"
              viewBox="0 0 1500 590"
              className="w-8 h-5"
            >
              <path
                d="M1445.85 377.24c-.12 15.34-.86 30.68.12 46.02.25 3.8.49 7.73.98 11.53.12.98.25 1.96.37 2.82 1.6 11.17 4.42 21.6 8.96 30.31h-.12c.37.25.74.37 1.1.61.98.74 2.09 1.35 2.82 2.45.37.49.49 1.23.12 1.84-.37.49-.98.86-1.6 1.1-2.33.86-4.79 1.23-7.24 1.47-2.45.25-4.91.49-7.24.74-2.45.25-4.91.49-7.24.74-2.45.37-4.91.25-7.36.49l-117.19 5.15c-8.47.25-16.69.37-26.38.37-.12-.25-.25-.37-.37-.61-5.77 9.82-40.49 71.17-103.44 68.59-37.18-1.47-79.64-16.57-103.32-66.88-.25-.61-.49-1.35-.74-1.96-13.25 1.23-351.31-2.7-351.31-2.7s-318.55-4.91-328.25-5.03c-.12-.12-.12-.25-.25-.49l-1.6 3.31c-1.35 2.94-27.61 66.51-96.33 71.54-9.82.74-19.76.37-29.57-1.47-60.99-11.41-85.04-77.18-89.33-79.27-1.1-.49-33.5.98-50.92-1.47-4.91-.74-9.82-2.09-14.36-3.8-5.15-1.96-46.38-26.26-77.55-66.63-.12-.25-.25-.49-.25-.74l8.47-95.59c0-.37.25-.61.49-.74 4.42-2.45 8.59-5.77 12.27-9.33 3.68-3.68 6.99-7.61 9.69-12.03 1.35-2.21 2.58-4.42 3.56-6.87.86-2.45 1.6-4.91 2.09-7.36 1.1-5.03 1.35-10.31 1.23-15.46-.12-5.15-.61-10.43-1.35-15.58-.37-2.58-.86-5.15-1.35-7.73l-.86-3.8c-.37-1.35-.37-2.7-.61-3.93-.12-1.23-.37-2.58-.74-3.68-.12-.25-.25-.49-.37-.61 0-.12-.12-.12-.12-.12s-.25-.12-.37-.25l-1.72-.98c-2.33-1.35-4.54-2.7-6.75-4.17-4.42-2.94-8.59-6.14-12.64-9.69-.12-.12-.25-.25-.25-.49-.86-3.93-1.47-7.85-1.96-11.78s-.74-7.85-.98-11.9c0-.49.37-.98.86-.98h.12c4.05.25 8.22.12 12.39-.37 4.05-.49 8.22-1.35 12.27-2.33 7.98-1.96 15.83-4.91 23.68-7.73 16.32-10.8 32.76-21.35 49.21-31.66 8.34-5.15 16.57-10.31 24.91-15.46l12.52-7.61c4.17-2.58 8.71-4.66 13.01-6.87 1.1-.61 2.09-1.1 2.94-1.84.37-.37.74-.74.74-.86 0 0-.12-.37-.61-.61-1.84-1.1-4.29-1.6-6.63-2.09-4.79-.98-9.57-1.96-14.36-3.07-4.79-1.23-9.57-2.45-14.11-4.05-2.33-.86-4.66-1.72-6.87-2.94-1.1-.61-2.21-1.23-3.31-1.96-.98-.74-2.09-1.47-2.82-2.94-.37-.74-.37-1.84.12-2.45.37-.74.98-1.1 1.6-1.6 1.1-.74 2.33-1.1 3.56-1.47 2.45-.74 4.91-1.1 7.24-1.47 4.91-.86 9.94-.74 14.6-1.35l28.96-4.29c38.65-5.64 77.43-10.68 116.33-14.97 38.9-4.17 77.8-7.61 116.94-10.06 129.09-8.22 301.13 1.72 351.19 10.68 19.27 3.44 38.29 8.22 56.94 14.23s36.94 13.13 54.73 20.98c19.39 8.59 153.63 85.65 153.63 85.65 8.34 5.15 16.57 10.31 24.79 15.71l6.14 4.05c.98.74 1.96 1.35 3.07 1.84.49.25 1.1.49 1.6.49l1.84.25 14.48 2.21 28.96 4.29 14.48 2.09c4.79.74 9.69 1.35 14.48 2.33 19.51 3.8 202.84 45.16 270.94 106.39 7.24 6.5 13.74 13.99 19.27 22.09 1.35 1.96 2.7 4.05 3.93 6.14.37.49.61.98.86 1.6.25.61.49 1.1.61 1.72.12.61.25 1.23.25 1.84 0 .61.12 1.23 0 1.84-.61 4.91-3.19 9.33-5.77 13.5-2.46 5.23-6.27 10.14-9.95 15.17z"
                fill="#ffffff"
              />
            </svg>
          </motion.div>
        </div>

        {/* Fixed text carousel */}
        <div className="h-8 flex items-center justify-center overflow-hidden">
          <motion.div
            key={currentPhraseIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-muted-foreground font-sf-pro text-sm"
          >
            {message || loadingPhrases[currentPhraseIndex]}
          </motion.div>
        </div>
        
        {/* Progress bar */}
        {progress !== undefined && (
          <div className="w-64 h-2 bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* SF Pro Font Styles */}
      <style jsx global>{`
        @font-face {
          font-family: 'SF Pro Text';
          src: local('SF Pro Text'), local('SFProText-Regular'), local('-apple-system');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        .font-sf-pro {
          font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji';
          letter-spacing: -0.015em;
        }
      `}</style>
    </div>
  )
}
