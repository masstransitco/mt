"use client"; // Only necessary if you're in Next.js 13+ app router and this file uses hooks or browser APIs

import React, { useEffect, useRef, useState } from "react";
import { LoadingOverlay } from "@/components/ui/loading-overlay"; // Updated import
import { ThreeOverlay } from "./ThreeOverlay";

interface RoutePath {
  lat: number;
  lng: number;
}

export function GMap() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(true);

  // Example state for route
  const [routePath, setRoutePath] = useState<RoutePath[]>([]);

  // Example method to calculate a route
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
          lng: point.lng(),
        }));
        setRoutePath(path);

        // Fit bounds to show the route
        const bounds = new google.maps.LatLngBounds();
        path.forEach(point => bounds.extend(point));
        mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      // Previously we might have used toast, but it's removed now
    }
  };

  // Load Google Maps script, then initialize the map
  useEffect(() => {
    let isMounted = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; // or however you provide your key

    if (!apiKey) {
      console.error("Google Maps API key is not configured");
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        // 1) Load script if it's not already on the page
        await new Promise<void>((resolve, reject) => {
          if (window.google?.maps) {
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

        // 2) Wait for container to exist
        while (isMounted && !containerRef.current) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (!isMounted) return;

        // 3) Create the map
        const map = new google.maps.Map(containerRef.current!, {
          center: { lat: 22.3035, lng: 114.1599 }, // Example: Hong Kong
          zoom: 15,
          tilt: 45,
          heading: 0,
          mapId: "15431d2b469f209e", // Vector tiles ID
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
        }
      }
    };

    loadGoogleMaps();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div
        ref={containerRef}
        className="absolute inset-0 bg-gray-200"
        style={{ minHeight: "500px" }}
      />

      {/* Loading overlay while waiting for map */}
      {(!mapLoaded || isLoadingScript) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <LoadingOverlay /> {/* Our updated loader component */}
        </div>
      )}

      {/* Render ThreeOverlay & any other components after map is ready */}
      {mapRef.current && mapLoaded && (
        <>
          <ThreeOverlay map={mapRef.current} />
          {/* If you have route-related components or inputs:
              <RouteInputs onRouteChange={handleRouteChange} /> 
          */}
        </>
      )}
    </div>
  );
}
