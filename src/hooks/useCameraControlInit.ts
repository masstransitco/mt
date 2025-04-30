"use client";

import { useEffect } from 'react';
import { useCameraAnimation } from './useCameraAnimation';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';
import cameraAnimationManager from '@/lib/cameraAnimationManager';
import { logger } from '@/lib/logger';

/**
 * This hook initializes the CameraAnimationManager with camera controls.
 * It should be used in the main map component (GMap.tsx) once.
 */
export function useCameraControlInit() {
  const cameraControls = useCameraAnimation();
  const { map } = useGoogleMaps();
  
  useEffect(() => {
    if (cameraControls && map) {
      logger.debug("[useCameraControlInit] Initializing camera animation manager with controls and valid map");
      cameraAnimationManager.initialize(cameraControls);
    }
  }, [cameraControls, map]);
  
  return cameraControls;
}