"use client";

import { useEffect } from 'react';
import { DEFAULT_ZOOM } from '@/constants/map';
import cameraStateManager from '@/lib/cameraStateManager';

interface CameraStateObserverProps {
  map: google.maps.Map | null;
  throttleMs?: number;
}

export function CameraStateObserver({ map, throttleMs = 100 }: CameraStateObserverProps) {
  useEffect(() => {
    if (!map) return;
    
    // Main camera change handler for regular events
    const handleCameraChange = () => {
      // Get current camera state directly from map
      const center = map.getCenter();
      const tilt = map.getTilt() ?? 0;
      const zoom = map.getZoom() ?? DEFAULT_ZOOM;
      const heading = map.getHeading() ?? 0;
      
      // Update shared state manager (throttling is now built into the manager)
      cameraStateManager.updateCameraState({
        tilt,
        zoom,
        heading,
        center: center ? { lat: center.lat(), lng: center.lng() } : null
      });
    };
    
    // Higher throttle for center changes which happen more frequently during panning
    // This improves performance while still tracking the center position
    const handleCenterChange = () => {
      const center = map.getCenter();
      if (!center) return;
      
      // Only update the center property
      // Built-in throttling now avoids performance issues during rapid panning
      cameraStateManager.updateCameraState({
        center: { lat: center.lat(), lng: center.lng() }
      });
    };
    
    // Attach listeners - use fewer events for better performance
    // 'idle' is fired after all map movements complete
    // Only listen to direct changes for immediate feedback
    const listeners = [
      map.addListener('idle', handleCameraChange),
      map.addListener('tilt_changed', handleCameraChange),
      map.addListener('zoom_changed', handleCameraChange),
      map.addListener('heading_changed', handleCameraChange),
      // Add center_changed with more aggressive throttling
      map.addListener('center_changed', handleCenterChange),
    ];
    
    // Initial state capture
    handleCameraChange();
    
    return () => {
      // Remove all listeners
      listeners.forEach(listener => google.maps.event.removeListener(listener));
    };
  }, [map, throttleMs]);
  
  // This is a utility component that doesn't render anything
  return null;
}