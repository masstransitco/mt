"use client";

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import '../styles/mapbox.css';

// NOTE: The Mapbox CSS import is done via a <link> tag in the parent component
// because Next.js client components sometimes fail to properly load CSS imports
// from node_modules. The error about missing Mapbox GL CSS occurs because this
// import is not consistently processed:
// import 'mapbox-gl/dist/mapbox-gl.css';

// Use environment variable for token like in MapCard
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MapboxWeatherMapProps {
  longitude: number;
  latitude: number;
  className?: string;
}

const MapboxWeatherMap: React.FC<MapboxWeatherMapProps> = ({ 
  longitude, 
  latitude,
  className = ''
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Helper to get a bounding box around the point
  const getBoundingBox = (center: [number, number], radiusKm: number = 0.5) => {
    const earthRadiusKm = 6371;
    const latRadian = (center[1] * Math.PI) / 180;
    const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const lngDelta =
      (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(latRadian);

    return new mapboxgl.LngLatBounds(
      [center[0] - lngDelta, center[1] - latDelta], // SW
      [center[0] + lngDelta, center[1] + latDelta]  // NE
    );
  };
  
  // Add a blue circle marker at the specified coordinates
  const addLocationMarker = (map: mapboxgl.Map, coordinates: [number, number]) => {
    try {
      // Remove existing marker if it exists
      if (map.getLayer('marker-glow')) {
        map.removeLayer('marker-glow');
      }
      if (map.getLayer('marker-center')) {
        map.removeLayer('marker-center');
      }
      if (map.getSource('location-marker')) {
        map.removeSource('location-marker');
      }
      
      // Add new marker source
      map.addSource('location-marker', {
        type: 'geojson',
        data: {
          type: 'Feature', 
          geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          properties: {}
        }
      });
      
      // Circle with pulsing effect
      map.addLayer({
        id: 'marker-glow',
        type: 'circle',
        source: 'location-marker',
        paint: {
          'circle-radius': 15,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.4,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3b82f6'
        }
      });
      
      map.addLayer({
        id: 'marker-center',
        type: 'circle',
        source: 'location-marker',
        paint: {
          'circle-radius': 5,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.9
        }
      });
    } catch (err) {
      console.warn('Error adding location marker:', err);
    }
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainer.current) return;
    
    const bounds = getBoundingBox([longitude, latitude]);
    
    try {
      // Create the map instance with similar settings to MapCard
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11', 
        center: [longitude, latitude],
        zoom: 14,
        pitch: 45, // Enhanced 3D perspective
        bearing: 30, // Angled view
        interactive: true, // Enable user interaction
        attributionControl: true, // Show attribution
        dragRotate: true,
        pitchWithRotate: true,
        maxBounds: bounds,
        minZoom: 12,
        maxZoom: 16
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true
        }),
        'top-right'
      );
      
      // Add geolocate control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );
      
      map.current.on('load', () => {
        if (!map.current) return;
        
        try {
          // Get a label layer (if any) to ensure buildings appear below labels
          let labelLayerId;
          try {
            labelLayerId = map.current.getStyle().layers.find(l => 
              l.type === 'symbol' && l.layout && l.layout['text-field']
            )?.id;
          } catch (e) {
            console.warn("Could not find label layer", e);
          }
          
          // Add regular 3D buildings layer without highlighting
          map.current.addLayer({
            id: 'bldg-3d',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#aaaaaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.75
            }
          }, labelLayerId);  // Place below labels if available
          
          setMapInitialized(true);
          
          // Animate to a slight angle
          map.current.easeTo({
            pitch: 45,
            bearing: 45,
            duration: 2000,
            zoom: 15 // Slightly closer zoom
          });
          
          // Small delay to ensure map layers are loaded before adding marker
          setTimeout(() => {
            if (!map.current) return;
            // Add marker at the station location
            addLocationMarker(map.current, [longitude, latitude]);
          }, 1000);
          
        } catch (error) {
          console.warn("Error adding map layers:", error);
        }
      });
      
      // Handle errors
      map.current.on('error', (e) => {
        console.error("Mapbox error:", e);
      });
      
    } catch (err) {
      console.error("Error initializing Mapbox for weather:", err);
    }

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [longitude, latitude]);

  // Update map center and highlighted building when coordinates change
  useEffect(() => {
    if (map.current && mapInitialized) {
      map.current.flyTo({
        center: [longitude, latitude],
        essential: true,
        duration: 1000
      });
      
      // Wait for the animation to complete before updating the marker
      setTimeout(() => {
        if (!map.current) return;
        
        // Update the location marker
        addLocationMarker(map.current, [longitude, latitude]);
      }, 1000);
    }
  }, [longitude, latitude, mapInitialized]);

  return (
    <div 
      ref={mapContainer} 
      className={`${className}`}
      style={{ width: '100%', height: '100%', borderRadius: 'inherit', overflow: 'hidden' }}
    />
  );
};

export default MapboxWeatherMap;