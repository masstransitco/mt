/**
 * src/lib/cartrack.ts
 *
 * Demonstrates calling /vehicles to retrieve a vehicle list,
 * with optional local asset mapping and optional plus-code retrieval.
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
// 3. fetchVehicleList calling /vehicles
// -----------------------------------------------------------------------------

/**
 * Optional params interface to pass query filters, page, limit, etc.
 * Adjust keys to match your API's valid filter fields.
 */
export interface FetchVehicleListParams {
  registration?: string;
  manufacturer?: string;
  model_year?: number;
  colour?: string;
  chassis_number?: string;
  page?: number;
  limit?: number;
  shouldRetrievePlusCode?: boolean;
}

/**
 * Calls /rest/vehicles with optional filters:
 *   e.g. /rest/vehicles?filter[registration]=ABC123&filter[manufacturer]=MG
 *
 * Returns an array of vehicles, each with:
 *   { registration, vehicle_id, model_year, odometer, location?, etc. }
 */
export async function fetchVehicleList(
  params: FetchVehicleListParams = {}
): Promise<any[]> {
  try {
    // 1) Construct the base URL
    let url = "https://fleetapi-hk.cartrack.com/rest/vehicles";

    // 2) Collect query params
    //    The new endpoint allows e.g. filter[registration], filter[manufacturer], etc.
    //    We'll build them into the query string if they're provided.
    const filters: Record<string, string | number> = {};

    if (params.registration) {
      filters["filter[registration]"] = params.registration;
    }
    if (params.manufacturer) {
      filters["filter[manufacturer]"] = params.manufacturer;
    }
    if (params.model_year) {
      filters["filter[model_year]"] = params.model_year;
    }
    if (params.colour) {
      filters["filter[colour]"] = params.colour;
    }
    if (params.chassis_number) {
      filters["filter[chassis_number]"] = params.chassis_number;
    }
    if (params.page) {
      filters["page"] = params.page;
    }
    if (params.limit) {
      filters["limit"] = params.limit;
    }

    // Build the query string
    const queryString = new URLSearchParams(filters as any).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // 3) Make the request
    const res = await fetch(url, getRequestOptions("GET"));
    if (!res.ok) {
      throw new Error(`fetchVehicleList failed: ${res.status} ${res.statusText}`);
    }
    const response = await res.json();

    // 4) Transform each vehicle to match your Car shape
    //    If the response has { data: [...] }, we proceed.
    if (response?.data?.length) {
      response.data = response.data.map((vehicle: any) => {
        // Extract local assets by registration
        const { modelUrl, image } = getLocalAssetsForRegistration(
          vehicle.registration
        );

        // Convert odometer from meters => kilometers
        const odometerKm = vehicle.odometer
          ? Math.round(vehicle.odometer / 1000)
          : 0;

        // If location fields exist, store them (or fallback to 0)
        const lat = vehicle.location?.latitude ?? 0;
        const lng = vehicle.location?.longitude ?? 0;

        // Return an object that lines up with your Car interface
        return {
          ...vehicle,

          // Overwrite or add your custom fields
          modelUrl,
          image,
          lat,
          lng,
          // For example:
          id: vehicle.vehicle_id ?? 0,
          name: vehicle.registration ?? "Unknown Name",
          model: vehicle.manufacturer ?? "Unknown Model",
          year: vehicle.model_year ?? 0,
          odometer: odometerKm,
        };
      });
    }

    // 5) Optionally retrieve plus code for the first vehicle
    if (params.shouldRetrievePlusCode && response?.data?.length) {
      const firstVehicle = response.data[0];
      if (firstVehicle.location) {
        const codeRes = await retrievePlusCodeFn(
          firstVehicle.location.latitude,
          firstVehicle.location.longitude
        );
        if (codeRes?.status === "OK" && codeRes.plus_code) {
          firstVehicle.plus_code = codeRes.plus_code;
        }
      }
    }

    // 6) Return the final array
    return response.data || [];
  } catch (error) {
    console.error("fetchVehicleList error:", error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// 4. Example: Helper to retrieve plus code (optional function)
// -----------------------------------------------------------------------------

async function retrievePlusCodeFn(latitude: number, longitude: number) {
  // e.g., call an external API to get plus code
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
 * with a specific registration or multiple filters.
 */
export async function getVehicleStatusOrAll(registration?: string) {
  try {
    const data = await fetchVehicleList({ registration });
    return data;
  } catch (err) {
    console.error("getVehicleStatusOrAll error:", err);
    throw err;
  }
}
