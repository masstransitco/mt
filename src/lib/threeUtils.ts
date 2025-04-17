"use client";

import { useState, useEffect } from "react";
import * as THREE from "three";

// Vehicle dimensions and constants
export const VEHICLE_DIMENSIONS = {
  DEFAULT: { width: 1.8, length: 4.2, height: 1.5 },
  TARGET_LENGTH: 4.2, // Target length in scene units (meters)
  PARKING_MARGIN_SIDE: 0.75, // 75cm margin on each side
  PARKING_MARGIN_END: 0.5,   // 50cm margin at front/back
  CAR_SPACING: 7, // Units between cars in the scene
  CAMERA_OFFSET: { x: 8.5, y: 2.0, z: 8.5 }, // Camera position offset from selected car
};

// Calculate optimal DPR based on device capabilities
export function getOptimalDPR(interactive: boolean = false): [number, number] {
  if (typeof window === 'undefined') return [1, 1.5];
  
  // Get device pixel ratio
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  // For high-end devices, allow higher DPR for interactive mode
  if (interactive && devicePixelRatio > 1) {
    return [1, Math.min(devicePixelRatio, 2)];
  }
  
  // For standard viewing mode, cap at 1.5
  return [1, Math.min(devicePixelRatio, 1.5)];
}

// Normalize model URL
export function normalizeModelUrl(modelUrl?: string): string {
  if (!modelUrl) return '/cars/defaultModel.glb';
  
  if (modelUrl.startsWith('/cars/')) {
    // Already has full path
    return modelUrl;
  } else if (modelUrl.endsWith('.glb')) {
    // Has extension but needs path
    return `/cars/${modelUrl}`;
  } else {
    // Add path and extension
    return `/cars/${modelUrl}.glb`;
  }
}

// Simple hook for client-side detection
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
}

// Create a shared easing function
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}