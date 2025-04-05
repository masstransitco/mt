/**
 * src/lib/cartrack.ts
 *
 * Calls /vehicles/status to retrieve each vehicle's lat/lng (vehicle.location),
 * plus merges additional fields (hardcoded model, year, etc.).
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------
const USERNAME = "URBA00001";
const API_PASSWORD = "fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33";

// Encode username:password into Base64 for Basic Auth
const base64Auth = btoa(`${USERNAME}:${API_PASSWORD}`);

function getRequestOptions(
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET"
): RequestInit {
  const headers = new Headers();
  headers.append("Authorization", `Basic ${base64Auth}`);
  headers.append("Content-Type", "application/json");

  return {
    method,
    headers,
    redirect: "manual",
  };
}

// -----------------------------------------------------------------------------
// 2. Mock data for development
// -----------------------------------------------------------------------------
const mockVehicles = [
  {
    vehicle_id: 1,
    registration: "ABC123",
    model: "Tesla Model 3",
    year: 2021,
    modelUrl: "/cars/defaultModel.glb",
    image: "/cars/car1.png",
    engine_type: "Electric",
    location: { latitude: 22.302711, longitude: 114.177216, updated: new Date().toISOString() },
    odometer: 15000,
    bearing: 90,
    speed: 0,
    ignition: false,
    idling: false,
    altitude: 100,
    electric: { battery_percentage_left: 85, battery_ts: new Date().toISOString() }
  },
  {
    vehicle_id: 2,
    registration: "DEF456",
    model: "Hyundai Kona Electric",
    year: 2022,
    modelUrl: "/cars/kona.glb",
    image: "/cars/car2.png",
    engine_type: "Electric",
    location: { latitude: 22.308711, longitude: 114.167216, updated: new Date().toISOString() },
    odometer: 8500,
    bearing: 45,
    speed: 0,
    ignition: false,
    idling: false,
    altitude: 80,
    electric: { battery_percentage_left: 72, battery_ts: new Date().toISOString() }
  },
  {
    vehicle_id: 3,
    registration: "GHI789",
    model: "MG4 Electric",
    year: 2023,
    modelUrl: "/cars/car3.glb",
    image: "/cars/car3.png",
    engine_type: "Electric",
    location: { latitude: 22.298711, longitude: 114.157216, updated: new Date().toISOString() },
    odometer: 3200,
    bearing: 180,
    speed: 0,
    ignition: false,
    idling: false,
    altitude: 90,
    electric: { battery_percentage_left: 93, battery_ts: new Date().toISOString() }
  },
  {
    vehicle_id: 4,
    registration: "JKL012",
    model: "BMW i4",
    year: 2023,
    modelUrl: "/cars/car4.glb",
    image: "/cars/car4.png",
    engine_type: "Electric",
    location: { latitude: 22.318711, longitude: 114.187216, updated: new Date().toISOString() },
    odometer: 6800,
    bearing: 270,
    speed: 0,
    ignition: false,
    idling: false,
    altitude: 75,
    electric: { battery_percentage_left: 64, battery_ts: new Date().toISOString() }
  },
  {
    vehicle_id: 5,
    registration: "NY6662",
    model: "Hyundai Kona",
    year: 2020,
    modelUrl: "/cars/kona.glb",
    image: "/cars/car2.png",
    engine_type: "Electric",
    location: { latitude: 22.312711, longitude: 114.177216, updated: new Date().toISOString() },
    odometer: 12500,
    bearing: 0,
    speed: 0,
    ignition: false,
    idling: false,
    altitude: 85,
    electric: { battery_percentage_left: 78, battery_ts: new Date().toISOString() }
  }
];

// -----------------------------------------------------------------------------
// 3. fetchVehicleList calling /vehicles/status
// -----------------------------------------------------------------------------

export interface FetchVehicleListParams {
  registration?: string;
  shouldRetrievePlusCode?: boolean;
}

/**
 * Calls /vehicles/status:
 *  - Extracts vehicle.location -> lat, lng
 *  - Hardcodes model to MG4, year to 2023, modelUrl to /cars/car1.glb
 *  - Flattens relevant fields (engine_type, bearing, speed, etc.)
 *  - Optionally retrieves plus-code
 */
export async function fetchVehicleList(
  params: FetchVehicleListParams = {}
): Promise<any[]> {
  // Use mock data in development
  if (process.env.NODE_ENV === 'development') {
    console.log("[CarTrack] Using mock vehicle data in development");
    return processMockVehicles(params);
  }

  try {
    const { registration, shouldRetrievePlusCode } = params;

    // 1) Base URL
    let url = "https://fleetapi-hk.cartrack.com/rest/vehicles/status";
    if (registration) {
      url += `?filter[registration]=${registration}`;
    }

    // 2) Make request
    const res = await fetch(url, getRequestOptions("GET"));
    if (!res.ok) {
      throw new Error(`fetchVehicleList failed: ${res.status} ${res.statusText}`);
    }
    const response = await res.json();

    // 3) Client-side filter (optional, if multiple records are returned)
    if (registration && Array.isArray(response?.data)) {
      response.data = response.data.filter(
        (item: any) => item.registration === registration
      );
    }

    // 4) Transform each vehicle
    let vehicles: any[] = [];
    if (Array.isArray(response?.data)) {
      vehicles = response.data.map((vehicle: any) => {
        // Flatten some nested fields
        const lat = vehicle.location?.latitude ?? 0;
        const lng = vehicle.location?.longitude ?? 0;
        const locationUpdated = vehicle.location?.updated ?? null;
        const positionDescription = vehicle.location?.position_description ?? null;

        // Convert odometer from meters to kilometers
        const odometerKm = vehicle.odometer ? Math.round(vehicle.odometer / 1000) : 0;

        return {
          // Keep existing vehicle fields in case you need them
          ...vehicle,

          // Hardcode model, year, modelUrl
          model: "MG4 Electric",
          year: 2023,
          modelUrl: vehicle.modelUrl ?? null,

          // Flatten location fields
          lat,
          lng,
          location_updated: locationUpdated,
          location_position_description: positionDescription,

          // Flatten electric battery fields
          electric_battery_percentage_left: vehicle.electric?.battery_percentage_left ?? null,
          electric_battery_ts: vehicle.electric?.battery_ts ?? null,

          // Convert odometer to km
          odometer: odometerKm,

          // The rest of the requested fields should already be present at top-level
          // or you can default them if needed:
          registration: vehicle.registration ?? "",
          engine_type: vehicle.engine_type ?? "",
          bearing: vehicle.bearing ?? 0,
          speed: vehicle.speed ?? 0,
          ignition: vehicle.ignition ?? false,
          idling: vehicle.idling ?? false,
          altitude: vehicle.altitude ?? 0,
          temp1: vehicle.temp1 ?? null,
          dynamic1: vehicle.dynamic1 ?? null,
          dynamic2: vehicle.dynamic2 ?? null,
          dynamic3: vehicle.dynamic3 ?? null,
          dynamic4: vehicle.dynamic4 ?? null,
        };
      });
    }

    // 5) Optionally retrieve plus-code for the first vehicle
    if (shouldRetrievePlusCode && vehicles.length > 0) {
      const first = vehicles[0];
      if (first.lat && first.lng) {
        const codeRes = await retrievePlusCodeFn(first.lat, first.lng);
        if (codeRes?.status === "OK" && codeRes.plus_code) {
          first.plus_code = codeRes.plus_code;
        }
      }
    }

    return vehicles;
  } catch (error) {
    console.error("fetchVehicleList (status) error:", error);
    throw error;
  }
}

// Process mock vehicles similar to the real API
function processMockVehicles(params: FetchVehicleListParams): any[] {
  const { registration } = params;
  
  // Filter based on registration if provided
  let filteredVehicles = mockVehicles;
  if (registration) {
    filteredVehicles = mockVehicles.filter(
      vehicle => vehicle.registration.toLowerCase() === registration.toLowerCase()
    );
  }

  // Transform each vehicle (same as the real API processing)
  return filteredVehicles.map(vehicle => {
    // Flatten some nested fields
    const lat = vehicle.location?.latitude ?? 0;
    const lng = vehicle.location?.longitude ?? 0;
    const locationUpdated = vehicle.location?.updated ?? null;
    const positionDescription = vehicle.location?.position_description ?? null;

    // Convert odometer from meters to kilometers (it's already in km in our mock)
    const odometerKm = vehicle.odometer;

    return {
      // Keep existing vehicle fields in case you need them
      ...vehicle,

      // Flatten location fields
      lat,
      lng,
      location_updated: locationUpdated,
      location_position_description: positionDescription,

      // Flatten electric battery fields
      electric_battery_percentage_left: vehicle.electric?.battery_percentage_left ?? null,
      electric_battery_ts: vehicle.electric?.battery_ts ?? null,

      // Convert odometer to km
      odometer: odometerKm,

      // The rest of the requested fields should already be present at top-level
      // or you can default them if needed:
      registration: vehicle.registration ?? "",
      engine_type: vehicle.engine_type ?? "",
      bearing: vehicle.bearing ?? 0,
      speed: vehicle.speed ?? 0,
      ignition: vehicle.ignition ?? false,
      idling: vehicle.idling ?? false,
      altitude: vehicle.altitude ?? 0,
      temp1: vehicle.temp1 ?? null,
      dynamic1: vehicle.dynamic1 ?? null,
      dynamic2: vehicle.dynamic2 ?? null,
      dynamic3: vehicle.dynamic3 ?? null,
      dynamic4: vehicle.dynamic4 ?? null,
    };
  });
}

// Example plus-code retrieval (optional)
async function retrievePlusCodeFn(latitude: number, longitude: number): Promise<any> {
  // mock
  return {
    status: "OK",
    plus_code: "8Q7X+FQ Hong Kong",
  };
}

// (Optional) Example usage
export async function getVehicleStatusOrAll(registration?: string) {
  try {
    return await fetchVehicleList({ registration });
  } catch (err) {
    console.error("getVehicleStatusOrAll error:", err);
    throw err;
  }
}