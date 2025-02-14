/**
 * src/lib/cartrack.ts
 *
 * Demonstrates calling /vehicles/status to retrieve a vehicle's location (lat/lng),
 * with optional local asset mapping and optional plus-code retrieval,
 * plus the new model/year/odometer fields if they exist in the response.
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------

// Demo credentials (store securely in production!)
const USERNAME = "URBA00001";
const API_PASSWORD = "fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33";

// Encode username:password into Base64 for Basic Auth
const base64Auth = btoa(`${USERNAME}:${API_PASSWORD}`);

/**
 * Creates Fetch options with Basic Auth headers
 */
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
// 2. Local Asset Mapping (registration -> modelUrl, image)
// -----------------------------------------------------------------------------

/**
 * Map of registrations to local .glb/.png files.
 * Adjust or add more as needed.
 */
const LOCAL_ASSETS_MAP: Record<string, { modelUrl: string; image: string }> = {
  ABC123: {
    modelUrl: "/cars/car1.glb",
    image: "/cars/car1.png",
  },
};

/**
 * Return local asset paths for a given registration.
 * Fallback to default if not found.
 */
function getLocalAssetsForRegistration(
  registration: string | undefined
): { modelUrl: string; image: string } {
  if (!registration) {
    return {
      modelUrl: "/cars/defaultModel.glb",
      image: "/cars/defaultImage.png",
    };
  }
  const assets = LOCAL_ASSETS_MAP[registration];
  if (assets) {
    return assets;
  }
  return {
    modelUrl: "/cars/defaultModel.glb",
    image: "/cars/defaultImage.png",
  };
}

// -----------------------------------------------------------------------------
// 3. fetchVehicleList calling /vehicles/status
// -----------------------------------------------------------------------------

/**
 * Optional interface if you want to filter by registration or retrieve plus-code.
 */
export interface FetchVehicleListParams {
  registration?: string;
  shouldRetrievePlusCode?: boolean; // renamed to avoid conflict with function call
}

/**
 * Calls /vehicles/status. 
 * 
 * - If `registration` is provided, appends ?filter[registration]=<reg>
 * - Extracts vehicle.location -> lat/lng
 * - Applies local modelUrl/image mapping
 * - Optionally calls retrievePlusCodeFn (if shouldRetrievePlusCode)
 *
 * Returns an array of vehicles, each with:
 *   { registration, lat, lng, modelUrl, image, plus_code?, model?, year?, odometer? etc. }
 */
export async function fetchVehicleList(
  params: FetchVehicleListParams = {}
): Promise<any[]> {
  try {
    const { registration, shouldRetrievePlusCode } = params;

    // 1) Construct the URL to /vehicles/status
    let url = "https://fleetapi-hk.cartrack.com/rest/vehicles/status";
    if (registration) {
      url += `?filter[registration]=${registration}`;
    }

    // 2) Make the request
    const res = await fetch(url, getRequestOptions("GET"));
    if (!res.ok) {
      throw new Error(`fetchVehicleList failed: ${res.status} ${res.statusText}`);
    }
    const response = await res.json();

    // 3) Optionally filter data by registration in JS
    if (registration && Array.isArray(response?.data)) {
      response.data = response.data.filter(
        (item: any) => item.registration === registration
      );
    }

    // 4) Transform each vehicle to include lat/lng + local assets
    if (Array.isArray(response?.data) && response.data.length > 0) {
      response.data = response.data.map((vehicle: any) => {
        const { modelUrl, image } = getLocalAssetsForRegistration(
          vehicle.registration
        );
        const lat = vehicle.location?.latitude ?? 0;
        const lng = vehicle.location?.longitude ?? 0;

        // If the /vehicles/status response has fields like 'manufacturer', 'model_year',
        // or 'odometer' in meters, add them here. If not, you'll see placeholders or 0.
        // e.g., we convert odometer from meters -> km
        let odometerKm = 0;
        if (vehicle.odometer) {
          odometerKm = Math.round(vehicle.odometer / 1000);
        }

        return {
          ...vehicle,
          // local asset mapping
          modelUrl,
          image,
          // lat/lng from location
          lat,
          lng,
          // new fields if present in the /vehicles/status data
          model: vehicle.manufacturer ?? "Unknown Model",
          year: vehicle.model_year ?? 0,
          odometer: odometerKm,
        };
      });
    }

    // 5) If we want plus-code for the first vehicle, call retrievePlusCodeFn
    if (shouldRetrievePlusCode && Array.isArray(response?.data) && response.data.length > 0) {
      const v = response.data[0];
      if (v.location) {
        const codeRes = await retrievePlusCodeFn(
          v.location.latitude,
          v.location.longitude
        );
        if (codeRes?.status === "OK" && codeRes.plus_code) {
          v.plus_code = codeRes.plus_code;
        }
      }
    }

    // Return an array of vehicles or empty array
    return Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    console.error("fetchVehicleList (status) error:", error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// 4. Example: Helper to retrieve plus code (optional function)
// -----------------------------------------------------------------------------

/**
 * Example function to fetch a plus code for a given lat/lng.
 * If you don't need plus codes, remove or replace with your real logic.
 */
async function retrievePlusCodeFn(latitude: number, longitude: number): Promise<any> {
  // e.g., call an external API
  // We'll just mock a response:
  return {
    status: "OK",
    plus_code: "8Q7X+FQ Hong Kong",
  };
}

// -----------------------------------------------------------------------------
// 5. (Optional) Example usage
// -----------------------------------------------------------------------------

/**
 * Example function demonstrating how you'd call fetchVehicleList
 * for a specific registration or all vehicles.
 */
export async function getVehicleStatusOrAll(registration?: string) {
  try {
    // If registration is provided, fetch that vehicle's status
    // otherwise fetch all vehicles in /vehicles/status
    const data = await fetchVehicleList({ registration });
    return data;
  } catch (err) {
    console.error("getVehicleStatusOrAll error:", err);
    throw err;
  }
}
