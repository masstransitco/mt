import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_CONTAINER_STYLE, createMapOptions } from '@/constants/map';
import { selectUserLocation, selectSearchLocation } from '@/store/userSlice';
import { useMapOverlays } from '@/hooks/useMapOverlays';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';
import { useCameraAnimation } from '@/hooks/useCameraAnimation';

interface MapContainerProps {
  /**
   * Callback fired when the map instance is available
   */
  onMapReady?: (map: google.maps.Map) => void;
  
  /**
   * Additional map container className
   */
  className?: string;
  
  /**
   * Whether to show overlays or not
   */
  showOverlays?: boolean;
  
  /**
   * Options for map overlays
   */
  overlayOptions?: {
    markerOptions?: any;
    threeOptions?: any;
    circleOptions?: any;
    walkingRouteOptions?: any;
  };
  
  /**
   * Children to render inside the map container
   */
  children?: React.ReactNode;

  /**
   * Additional controls to render over the map
   */
  controls?: React.ReactNode;

  /**
   * Initial center position override
   */
  initialCenter?: google.maps.LatLngLiteral;

  /**
   * Initial zoom level override
   */
  initialZoom?: number;
}

/**
 * Core map container that handles map initialization and overlays
 * 
 * This is an extracted component from GMap.tsx that focuses only on 
 * map initialization and overlay management.
 */
export function MapContainer({
  onMapReady,
  className,
  showOverlays = true,
  overlayOptions = {},
  children,
  controls,
  initialCenter,
  initialZoom
}: MapContainerProps) {
  const dispatch = useAppDispatch();
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayRefForCamera = useRef<any>(null);
  
  // Get data from Redux
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);
  
  // Use the centralized Google Maps provider
  const { isLoaded, googleMapsReady, setMap: setCtxMap } = useGoogleMaps();
  
  // Initialize camera animation system
  const cameraControls = useCameraAnimation(actualMap);
  
  // Initialize map options when Google Maps is ready
  useEffect(() => {
    if (googleMapsReady) {
      setMapOptions(createMapOptions());
    }
  }, [googleMapsReady]);
  
  // Initialize overlays
  const { manager: overlayManager, threeOverlay } = useMapOverlays(actualMap, overlayOptions);
  
  // Handle map load
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    console.log('[MapContainer] Map loaded');
    setActualMap(map);
    setCtxMap?.(map);
    onMapReady?.(map);
  }, [onMapReady, setCtxMap]);
  
  // Toggle overlay visibility
  useEffect(() => {
    if (actualMap) {
      if (showOverlays) {
        overlayManager.setTypeVisible('marker', true);
        overlayManager.setTypeVisible('three', true);
        overlayManager.setTypeVisible('circle', true);
        overlayManager.setTypeVisible('walking', true);
      } else {
        overlayManager.setTypeVisible('marker', false);
        overlayManager.setTypeVisible('three', false);
        overlayManager.setTypeVisible('circle', false);
        overlayManager.setTypeVisible('walking', false);
      }
    }
  }, [actualMap, showOverlays, overlayManager]);

  // Connect camera change events to THREE.js overlay for redraw requests
  useEffect(() => {
    if (actualMap && threeOverlay) {
      // Store the reference for use in other components
      overlayRefForCamera.current = threeOverlay;
      
      const handleCameraChange = () => {
        if (overlayRefForCamera.current) {
          overlayRefForCamera.current.requestRedraw?.();
        }
      };
      
      const tiltListener = google.maps.event.addListener(actualMap, "tilt_changed", handleCameraChange);
      const headingListener = google.maps.event.addListener(actualMap, "heading_changed", handleCameraChange);
      const zoomListener = google.maps.event.addListener(actualMap, "zoom_changed", handleCameraChange);
      const centerListener = google.maps.event.addListener(actualMap, "center_changed", handleCameraChange);
      
      return () => {
        google.maps.event.removeListener(tiltListener);
        google.maps.event.removeListener(headingListener);
        google.maps.event.removeListener(zoomListener);
        google.maps.event.removeListener(centerListener);
      };
    }
  }, [actualMap, threeOverlay]);

  // Create utility function for animateToLocation that uses the CameraAnimationManager
  const animateToLocation = useCallback((loc: google.maps.LatLngLiteral, zoom?: number) => {
    import('@/lib/cameraAnimationManager').then(module => {
      const cameraManager = module.default;
      cameraManager.animateToLocation(
        loc,
        { zoom: zoom || 16 },
        cameraControls
      );
    });
  }, [cameraControls]);

  // Expose the map instance, overlayManager, and animation controls
  const mapContext = useMemo(() => ({
    map: actualMap,
    overlayManager,
    cameraControls,
    animateToLocation,
    threeOverlayRef: overlayRefForCamera
  }), [actualMap, overlayManager, cameraControls, animateToLocation]);
  
  return (
    <div 
      ref={mapContainerRef} 
      className={`relative w-full h-full ${className || ''}`}
    >
      {isLoaded && googleMapsReady ? (
        <>
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={initialCenter || userLocation || DEFAULT_CENTER}
            zoom={initialZoom || DEFAULT_ZOOM}
            options={mapOptions || {}}
            onLoad={handleMapLoad}
          >
            {/* Children are rendered once map is ready */}
            {actualMap && children}
          </GoogleMap>
          
          {/* Map controls overlay */}
          {actualMap && controls && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="pointer-events-auto">
                {controls}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-gray-500">Loading map...</div>
        </div>
      )}
    </div>
  );
}