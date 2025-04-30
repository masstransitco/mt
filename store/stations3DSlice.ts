// src/store/stations3DSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

/** A single 3D feature from stations_3d.geojson */
export interface Station3DFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    ObjectId: number;
    Place?: string;
    Address?: string;
    District?: string;
    topHeight?: number | null; // We'll store the parsed building height here
    // Add additional known fields as needed:
    Sheet_No?: string;
    Format_3DS?: string;
    Format_FBX?: string;
    Format_MAX?: string;
    Format_VRML?: string;
    // And if you want to allow any unrecognized fields:
    [key: string]: unknown;
  };
}

interface Stations3DState {
  items: Station3DFeature[];
  loading: boolean;
  error: string | null;
}

const initialState: Stations3DState = {
  items: [],
  loading: false,
  error: null,
};

/** 
 * Helper to parse the raw TOPHEIGHT (which might be a string like "[np.float64(98.4)]")
 * into a numeric value. Returns null if it’s missing or unparseable.
 */
function parseTopHeight(raw: unknown): number | null {
  if (!raw) return null;
  // Convert to string and extract a numeric substring:
  // e.g. "[np.float64(98.4)]" -> "98.4"
  const match = String(raw).match(/([\d.]+)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/**
 * Thunk to fetch stations_3d.geojson and create fallback 3D polygons for stations without 3D data.
 * This provides a seamless experience by ensuring all stations have 3D representations.
 */
export const fetchStations3D = createAsyncThunk<
  Station3DFeature[], // success payload
  void,               // no args
  { rejectValue: string, state: RootState }
>(
  "stations3D/fetchStations3D",
  async (_, { rejectWithValue, getState }) => {
    try {
      // Get stations from store or fetch directly if not available
      let stations = getState().stations.items;
      
      // If stations aren't in the store yet, fetch them directly
      if (!stations || stations.length === 0) {
        console.log("Stations not found in store, fetching directly for 3D fallbacks");
        try {
          const stationsResponse = await fetch("/stations.geojson");
          if (!stationsResponse.ok) {
            console.warn("Failed to fetch stations.geojson for fallback buildings");
          } else {
            const stationsData = await stationsResponse.json();
            if (stationsData.type === "FeatureCollection" && stationsData.features) {
              stations = stationsData.features;
            }
          }
        } catch (error) {
          console.warn("Error fetching stations for fallback buildings:", error);
          // Continue with empty stations array if fetch fails
        }
      }
      
      // Now fetch the real 3D building data
      const response = await fetch("/stations_3d.geojson"); // Changed to direct file path
      if (!response.ok) {
        // Try API fallback if direct file access fails
        const apiResponse = await fetch("/api/stations3d");
        if (!apiResponse.ok) {
          throw new Error(`Failed to fetch 3D stations data`);
        }
        return await processStations3DResponse(apiResponse, stations);
      }
      
      return await processStations3DResponse(response, stations);
    } catch (err: any) {
      console.error("Error in fetchStations3D:", err);
      return rejectWithValue(err.message);
    }
  }
);

// Helper function to process the stations 3D response and create fallbacks
async function processStations3DResponse(
  response: Response, 
  stations: any[]
): Promise<Station3DFeature[]> {
  const data = await response.json();
  if (data.type !== "FeatureCollection" || !data.features) {
    throw new Error("Invalid 3D geojson format");
  }

  // Transform each feature to include a numeric topHeight
  const cleanedFeatures = data.features.map((f: any) => {
    const topHeight = parseTopHeight(f.properties?.TOPHEIGHT);
    
    return {
      ...f,
      properties: {
        ...f.properties,
        topHeight, // numeric or null
      },
    };
  });
  
  // First, validate if the buildings have proper polygon coordinates
  const validBuildingsMap = new Map<number, Station3DFeature>();
  const invalidBuildingIds = new Set<number>();
  
  // Identify buildings with valid polygon coordinates that can be extruded
  cleanedFeatures.forEach((feature: Station3DFeature) => {
    const objectId = feature.properties.ObjectId;
    if (typeof objectId !== 'number') return;
    
    // Check if coordinates are valid for extrusion
    const coords = feature.geometry.coordinates[0];
    if (!coords || coords.length < 3) {
      // This building has invalid coordinates
      invalidBuildingIds.add(objectId);
      return;
    }
    
    // Validate the first coordinate point
    const [lng, lat] = coords[0];
    if (!lng || !lat || typeof lng !== 'number' || typeof lat !== 'number' || 
        Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      invalidBuildingIds.add(objectId);
      return;
    }
    
    // This building has valid extrusion coordinates
    validBuildingsMap.set(objectId, feature);
  });
  
  // Log info for debugging
  console.log(`Processing 3D buildings: ${cleanedFeatures.length} total, ${validBuildingsMap.size} valid for extrusion, ${invalidBuildingIds.size} invalid`);
  
  // For each station, create a fallback square polygon if it doesn't have a valid building
  const fallbackFeatures: Station3DFeature[] = [];
  
  stations.forEach(station => {
    const objectId = station.properties.ObjectId;
    
    // Skip if ObjectId is missing
    if (typeof objectId !== 'number') {
      return;
    }
    
    // If this station already has a valid building for extrusion, skip it
    if (validBuildingsMap.has(objectId)) {
      return;
    }
    
    // Create a square polygon around the station point
    const [lng, lat] = station.geometry.coordinates;
    
    // Skip if coordinates are invalid
    if (!lng || !lat || typeof lng !== 'number' || typeof lat !== 'number') {
      return;
    }
    
    const DEFAULT_SIZE = 0.0005; // approximately 50-55 meters
    
    // Calculate corner coordinates for a square around the point
    const squarePolygon = [
      [lng - DEFAULT_SIZE, lat - DEFAULT_SIZE], // bottom-left
      [lng + DEFAULT_SIZE, lat - DEFAULT_SIZE], // bottom-right
      [lng + DEFAULT_SIZE, lat + DEFAULT_SIZE], // top-right
      [lng - DEFAULT_SIZE, lat + DEFAULT_SIZE], // top-left
      [lng - DEFAULT_SIZE, lat - DEFAULT_SIZE]  // close the polygon by repeating first point
    ];
    
    // Determine building height based on station properties
    let buildingHeight = 150; // Default height
    
    // If station has totalSpots property, use it to estimate building size
    if (station.properties.totalSpots) {
      const spots = station.properties.totalSpots;
      if (spots > 50) {
        buildingHeight = 200;
      } else if (spots > 20) {
        buildingHeight = 175;
      }
    }
    
    // If station has maxPower property, use it to adjust height
    if (station.properties.maxPower) {
      const power = station.properties.maxPower;
      if (power > 100) {
        buildingHeight += 50;
      } else if (power > 50) {
        buildingHeight += 25;
      }
    }
    
    // Create the fallback feature
    const fallbackFeature: Station3DFeature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [squarePolygon]
      },
      properties: {
        ObjectId: objectId,
        Place: station.properties.Place,
        Address: station.properties.Address,
        District: station.properties.District,
        topHeight: buildingHeight
      }
    };
    
    fallbackFeatures.push(fallbackFeature);
  });
  
  // Log the number of fallback buildings created
  console.log(`Created ${fallbackFeatures.length} fallback buildings`);
  
  // For cleaner rendering, we only want valid buildings + fallbacks
  // We're not returning the invalid buildings from cleanedFeatures
  const finalFeatures = [...Array.from(validBuildingsMap.values()), ...fallbackFeatures];
  console.log(`Returning ${finalFeatures.length} total buildings for rendering (${validBuildingsMap.size} real + ${fallbackFeatures.length} fallbacks)`);
  
  return finalFeatures;
}

const stations3DSlice = createSlice({
  name: "stations3D",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations3D.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchStations3D.fulfilled,
        (state, action: PayloadAction<Station3DFeature[]>) => {
          state.loading = false;
          state.items = action.payload;
        }
      )
      .addCase(fetchStations3D.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default stations3DSlice.reducer;

// SELECTORS
export const selectStations3DLoading = (state: RootState) => state.stations3D.loading;
export const selectStations3DError = (state: RootState) => state.stations3D.error;
export const selectStations3D = (state: RootState) => state.stations3D.items;