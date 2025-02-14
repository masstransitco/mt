/**
 * src/lib/cartrack.ts
 *
 * Calls /vehicles/status to retrieve each vehicle's lat/lng (vehicle.location),
 * plus merges additional fields (model, year, odometer) if present.
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
// 2. Local Asset Mapping (registration -> modelUrl, image)
// -----------------------------------------------------------------------------
const LOCAL_ASSETS_MAP: Record<string, { modelUrl: string; image: string }> = {
  ABC123: {
    modelUrl: "/cars/car1.glb",
    image: "/cars/car1.png",
  },
};

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

export interface FetchVehicleListParams {
  registration?: string;
  shouldRetrievePlusCode?: boolean;
}

/**
 * Calls /vehicles/status:
 *  - Extracts vehicle.location -> lat/lng
 *  - Merges manufacturer, model_year, odometer if present
 *  - Applies local modelUrl/image mapping
 *  - Optionally retrieves plus-code
 */
export async function fetchVehicleList(
  params: FetchVehicleListParams = {}
): Promise<any[]> {
  try {
    const { registration, shouldRetrievePlusCode } = params;

    // 1) Base URL for location data
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

    // 3) Optionally filter by registration in JS
    if (registration && Array.isArray(response?.data)) {
      response.data = response.data.filter(
        (item: any) => item.registration === registration
      );
    }

    // 4) Transform each vehicle
    if (Array.isArray(response?.data) && response.data.length) {
      response.data = response.data.map((vehicle: any) => {
        const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
        const lat = vehicle.location?.latitude ?? 0;
        const lng = vehicle.location?.longitude ?? 0;

        // If you have 'manufacturer', 'model_year', 'odometer' (in meters), map them here
        // Odometer conversion: meters → km
        const odometerKm = vehicle.odometer ? Math.round(vehicle.odometer / 1000) : 0;

        return {
          ...vehicle,
          modelUrl,
          image,
          lat,
          lng,
          // For convenience, rename fields to e.g. 'model', 'year' if they exist
          model: vehicle.manufacturer ?? "Unknown Model",
          year: vehicle.model_year ?? 0,
          odometer: odometerKm,
        };
      });
    }

    // 5) Optionally get plus-code for first vehicle
    if (shouldRetrievePlusCode && Array.isArray(response?.data) && response.data.length > 0) {
      const first = response.data[0];
      if (first.location) {
        const codeRes = await retrievePlusCodeFn(
          first.location.latitude,
          first.location.longitude
        );
        if (codeRes?.status === "OK" && codeRes.plus_code) {
          first.plus_code = codeRes.plus_code;
        }
      }
    }

    return Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    console.error("fetchVehicleList (status) error:", error);
    throw error;
  }
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
