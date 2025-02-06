'use client'

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@/components/ui/loading"; // Example loading component
import { useToast } from "@/hooks/use-toast";     // Example toast hook
import { ThreeOverlay } from "./ThreeOverlay";    // Our new Three.js overlay

interface Station {
  name: string;
  lat: number;
  lng: number;
}

// You may also have route-related interfaces:
interface RoutePath {
  lat: number;
  lng: number;
}

/**
 * GMap component
 * 1) Loads the Google Maps script (if not already available).
 * 2) Creates a map instance in the provided container ref.
 * 3) Maintains the current functionalities (directions, etc.).
 * 4) Utilizes the ThreeOverlay component to render 3D station markers.
 */
export function GMap() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(true);

  // Example state for directions
  const [routePath, setRoutePath] = useState<RoutePath[]>([]);

  // Example station data (replace with real data in your app)
  const [stations, setStations] = useState<Station[]>([
    { name: "Station A", lat: 22.302711, lng: 114.177216 },
    { name: "Station B", lat: 22.305164, lng: 114.172997 },
    { name: "Station C", lat: 22.308619, lng: 114.163226 },
  ]);

  const { toast } = useToast();

  /**
   * Example method to calculate a route between two points.
   * You may already have your own route/directions logic,
   * so keep that as is.
   */
  const handleRouteChange = async (departure: string, arrival: string) => {
    if (!mapRef.current) return;
    try {
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: departure,
        destination: arrival,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      });

      const route = result.routes[0];
      if (route && route.overview_path) {
        const path = route.overview_path.map(point => ({
          lat: point.lat(),
          lng: point.lng()
        }));
        setRoutePath(path);

        // Zoom/fit map to route
        const bounds = new google.maps.LatLngBounds();
        path.forEach(point => bounds.extend(point));
        mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      toast({
        title: "Route Error",
        description: "Could not calculate route. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Load the Google Maps script (if needed), then initialize the map.
   */
  useEffect(() => {
    let isMounted = true;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; // Or however you provide your API key

    if (!apiKey) {
      toast({
        title: "Configuration Error",
        description: "Google Maps API key is not configured",
        variant: "destructive",
      });
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        // 1) Load script if it's not already on the page
        await new Promise<void>((resolve, reject) => {
          if (window.google?.maps) {
            // Maps script is already loaded
            setIsLoadingScript(false);
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.defer = true;

          script.onload = () => {
            if (isMounted) {
              setIsLoadingScript(false);
            }
            resolve();
          };
          script.onerror = (error) => {
            console.error("Failed to load Google Maps:", error);
            reject(new Error("Failed to load Google Maps"));
          };

          document.head.appendChild(script);
        });

        // 2) Wait for container to exist in the DOM
        while (isMounted && !containerRef.current) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (!isMounted) return;

        // 3) Create map
        const map = new google.maps.Map(containerRef.current!, {
          center: { lat: 22.3035, lng: 114.1599 }, // Example center (Hong Kong)
          zoom: 15,
          tilt: 45,
          heading: 0,
          mapId: "15431d2b469f209e", // Example vector tile style
          disableDefaultUI: false,
          mapTypeId: "roadmap",
          backgroundColor: "transparent",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          rotateControl: true,
        });

        if (isMounted) {
          mapRef.current = map;
          setMapLoaded(true);
        }
      } catch (error) {
        console.error("Map initialization error:", error);
        if (isMounted) {
          setIsLoadingScript(false);
          toast({
            title: "Error",
            description: "Failed to initialize the map",
            variant: "destructive",
          });
        }
      }
    };

    loadGoogleMaps();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  return (
    <div className="relative w-full h-full">
      {/* Container for the map */}
      <div
        ref={containerRef}
        className="absolute inset-0 bg-gray-200"
        style={{ minHeight: "500px" }}
      />

      {/* Loading overlay while waiting for the map */}
      {(!mapLoaded || isLoadingScript) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader />
        </div>
      )}

      {/* Once map is ready, render overlays and any UI controls */}
      {mapRef.current && mapLoaded && (
        <>
          {/* Example usage of the Three.js overlay for stations */}
          <ThreeOverlay
            map={mapRef.current}
            stations={stations}
          />

          {/* Here you could place route inputs or any other controls that
              use the map, e.g.:
              <RouteInputs onRouteChange={handleRouteChange} />
          */}
        </>
      )}
    </div>
  );
}
