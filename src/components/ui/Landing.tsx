"use client"

import { motion, SVGMotionProps } from "framer-motion"
import { Button } from "@/components/ui/button"
import type React from "react"

type LogoSvgProps = SVGMotionProps<SVGSVGElement>

const AnimatedLogoSvg: React.FC<LogoSvgProps> = (props) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      id="Layer_1"
      viewBox="0 0 2100 950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      {...props}
    >
      <motion.path
        d="M1221.62 684.48V108.15c0-4.69-3.8-8.49-8.49-8.49H1109.7c-4.69 0-8.49 3.8-8.49 8.49v116.13c0 35.81-29.02 64.83-64.83 64.83H792.12c-.97 0-1.93-.17-2.85-.5-23.3-8.32-49.3-12.73-77.51-12.73-79.91 0-143.64 31.44-185.78 88.91-3.58 4.89-10.95 4.59-14.11-.57-33.84-55.37-94.35-88.34-171.81-88.34-62.91 0-115.68 21.15-155.29 60.44-5.35 5.3-14.45 1.5-14.45-6.04v-25.02c0-4.69-3.8-8.49-8.49-8.49H58.49c-4.69 0-8.49 3.8-8.49 8.49v522.9c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V518.67c0-76.27 52.64-126.76 129.98-126.76 74.13 0 121.39 49.41 121.39 124.61v311.64c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V518.67c0-76.27 52.64-126.76 129.99-126.76 74.13 0 121.39 49.41 121.39 124.61v311.64c0 4.69 3.8 8.49 8.49 8.49h103.34c4.69 0 8.49-3.8 8.49-8.49V481.07c0-30.34-4.86-58.14-13.99-82.84-2.06-5.58 2.04-11.5 7.98-11.48l185.04.8a8.48 8.48 0 0 1 8.45 8.49v335.72c0 56.03 55.08 101.74 111.09 102.82 89.54 1.72 176.62 3.21 203.35-.51 4.2-.59 7.33-4.16 7.33-8.41v-81.63c0-4.69-3.8-8.49-8.49-8.49h-141.81c-28.18 0-51.04-22.86-51.04-51.06z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="8"
        initial={{ pathLength: 0, fill: "rgba(255, 255, 255, 0)" }}
        animate={{
          pathLength: 1,
          fill: "rgba(255, 255, 255, 0.7)",
        }}
        transition={{
          pathLength: { duration: 2, ease: "easeInOut" },
          fill: { duration: 1, delay: 1.5 },
        }}
      />
      <motion.path
        d="M1934.77 633.74c-23.43 66.53-87.65 109.51-163.59 109.51-49.34 0-94.79-18.38-127.97-51.76-33.27-33.47-51.59-79.41-51.59-129.37 0-49.96 18.32-95.91 51.59-129.37 33.18-33.38 78.63-51.76 127.97-51.76 75.94 0 140.16 42.98 163.59 109.51 1.2 3.4 4.4 5.67 8.01 5.67h98.73c5.43 0 9.47-5.03 8.29-10.33-6.79-30.55-18.76-59.28-35.56-85.41-16.52-25.67-37.34-48.24-61.87-67.08-24.69-18.96-52.55-33.7-82.81-43.79-31.14-10.39-64.23-15.65-98.36-15.65-33.28 0-65.5 5.04-95.68 14.73-.83.27-1.7.41-2.57.41h-416.57c-4.69 0-8.49 3.8-8.49 8.49v82.84c0 4.69 3.8 8.49 8.49 8.49h261.67c6.75 0 10.81 7.5 7.11 13.12-30.5 46.37-46.87 101.56-46.87 160.14 0 79.19 29.91 152.19 84.22 205.57 54.23 53.3 128.36 82.65 208.69 82.65 34.13 0 67.23-5.27 98.36-15.65 30.27-10.1 58.12-24.83 82.81-43.79 24.54-18.85 45.36-41.42 61.87-67.08 16.81-26.12 28.77-54.85 35.56-85.4 1.18-5.3-2.86-10.33-8.28-10.33h-98.73c-3.61-.03-6.82 2.25-8.02 5.64z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="8"
        initial={{ pathLength: 0, fill: "rgba(255, 255, 255, 0)" }}
        animate={{
          pathLength: 1,
          fill: "rgba(255, 255, 255, 0.7)",
        }}
        transition={{
          pathLength: { duration: 2, delay: 0.5, ease: "easeInOut" },
          fill: { duration: 1, delay: 2 },
        }}
      />
    </motion.svg>
  )
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full text-[#276EF1]" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export default function MtcLanding() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="max-w-4xl mx-auto"
        >
          <motion.div
            className="mb-8 mx-auto w-full max-w-[250px] relative"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 1.5,
              type: "spring",
              stiffness: 100,
            }}
          >
            {/* Glow effect behind the logo */}
            <div className="absolute inset-0 blur-2xl bg-[#276EF1]/10 rounded-full transform scale-110 opacity-70"></div>

            {/* Main logo with blur */}
            <div className="relative blur-sm">
              <AnimatedLogoSvg className="w-full h-auto text-white/80" />
            </div>

            {/* Sharper overlay for contrast */}
            <div className="absolute inset-0 opacity-60">
              <AnimatedLogoSvg className="w-full h-auto text-white" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="inline-block group relative bg-gradient-to-b from-white/10 to-white/5 
                        p-px rounded-2xl backdrop-blur-lg 
                        overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <Button
  variant="ghost"
  className="rounded-[1.15rem] px-8 py-6 text-lg font-semibold backdrop-blur-md 
             bg-black/80 hover:bg-black/90
             text-white transition-all duration-300 
             group-hover:-translate-y-0.5 border border-white/10
             hover:shadow-md hover:shadow-[#276EF1]/20"
  onClick={() => {
    window.location.href = "https://www.masstransitcar.com"
  }}
>
  <span className="opacity-90 group-hover:opacity-100 transition-opacity">
    Start Driving
  </span>
  <span
    className="ml-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5 
               transition-all duration-300 text-[#276EF1]"
  >
    →
  </span>
</Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
