/**
 * src/lib/cartrack.ts
 *
 * Final approach using /vehicles/status for location data.
 * 1) Basic Auth Setup
 * 2) Local Asset Mapping
 * 3) fetchVehicleList calls Cartrack /vehicles/status
 *    with optional registration filter
 * 4) Extracts vehicle.location -> lat/lng
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------

// Demo credentials (store securely in production!)
const USERNAME = 'URBA00001';
const API_PASSWORD = 'fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33';

// Encode username:password into Base64 for Basic Auth
const base64Auth = btoa(`${USERNAME}:${API_PASSWORD}`);

/**
 * Creates Fetch options with Basic Auth headers
 */
function getRequestOptions(method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): RequestInit {
  const headers = new Headers();
  headers.append('Authorization', `Basic ${base64Auth}`);
  headers.append('Content-Type', 'application/json');

  return {
    method,
    headers,
    redirect: 'manual',
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
  // Example: If Cartrack vehicle has registration "ABC123", use these local assets
  ABC123: {
    modelUrl: '/cars/car1.glb',
    image: '/cars/car1.png',
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
      modelUrl: '/cars/defaultModel.glb',
      image: '/cars/defaultImage.png',
    };
  }
  const assets = LOCAL_ASSETS_MAP[registration];
  if (assets) {
    return assets;
  }
  return {
    modelUrl: '/cars/defaultModel.glb',
    image: '/cars/defaultImage.png',
  };
}

// -----------------------------------------------------------------------------
// 3. fetchVehicleList (replacing old logic, now calls /vehicles/status)
// -----------------------------------------------------------------------------

/**
 * Optional param type, if you only need a registration filter.
 * Extend if /vehicles/status supports other filters.
 */
export interface FetchVehicleListParams {
  registration?: string;
  retrievePlusCode?: boolean; // if you want to get a plus code
}

/**
 * Replaces old "fetchVehicleList" with a call to /vehicles/status.
 * - If a registration is provided, appends ?filter[registration]=<reg>
 * - Extracts location -> lat / lng
 * - Applies local assets
 *
 * Returns an array of "vehicles" with lat, lng, modelUrl, etc.
 */
export async function fetchVehicleList(params: FetchVehicleListParams = {}): Promise<any[]> {
  try {
    const { registration, retrievePlusCode } = params;

    // 1) Construct the URL
    let url = 'https://fleetapi-hk.cartrack.com/rest/vehicles/status';
    if (registration) {
      url += `?filter[registration]=${registration}`;
    }

    // 2) Make the request with Basic Auth
    const res = await fetch(url, getRequestOptions('GET'));
    if (!res.ok) {
      throw new Error(`fetchVehicleList failed: ${res.status} ${res.statusText}`);
    }
    const response = await res.json();

    // 3) (Optional) Filter data in JS if registration was provided
    //    to ensure only that vehicle remains
    if (registration && response?.data?.length) {
      response.data = response.data.filter((item: any) => item.registration === registration);
    }

    // 4) Transform each vehicle:
    //    - location.latitude -> lat
    //    - location.longitude -> lng
    //    - local assets from registration
    if (response?.data?.length) {
      response.data = response.data.map((vehicle: any) => {
        const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
        const lat = vehicle.location?.latitude ?? 0;
        const lng = vehicle.location?.longitude ?? 0;

        return {
          ...vehicle,
          modelUrl,
          image,
          lat,
          lng,
        };
      });
    }

    // 5) If we want to fetch a plus code for the first vehicle
    if (retrievePlusCode && response?.data?.length) {
      const v = response.data[0];
      if (v.location) {
        const codeRes = await retrievePlusCode(v.location.latitude, v.location.longitude);
        if (codeRes?.status === 'OK' && codeRes.plus_code) {
          v.plus_code = codeRes.plus_code;
        }
      }
    }

    // Return array of vehicles or empty array
    return response.data || [];
  } catch (error) {
    console.error('fetchVehicleList (status) error:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// 4. Example: Helper to retrieve plus code (optional)
// -----------------------------------------------------------------------------

/**
 * Example function to fetch a plus code for a given lat/lng.
 * If you don't need plus codes, remove this logic.
 */
async function retrievePlusCode(latitude: number, longitude: number): Promise<any> {
  // Example: call some external API or Google Geocoding
  // This is just a mock for demonstration.
  return {
    status: 'OK',
    plus_code: '8Q7X+FQ Hong Kong',
  };
}

// -----------------------------------------------------------------------------
// 5. Example usage
// -----------------------------------------------------------------------------

/**
 * Example function demonstrating how you'd call fetchVehicleList
 * for a specific registration or all vehicles.
 */
export async function getVehicleStatusOrAll(registration?: string) {
  try {
    // If we pass a registration, we get that vehicle's status
    // otherwise we get all vehicles in /vehicles/status
    const data = await fetchVehicleList({ registration });
    return data;
  } catch (err) {
    console.error('getVehicleStatusOrAll error:', err);
    throw err;
  }
}
