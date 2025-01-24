/**
 * src/lib/cartrack.ts
 *
 * Demonstrates:
 * 1) Basic Auth Setup
 * 2) Local Asset Mapping
 * 3) Fetch Vehicle Status (with location) from Cartrack
 * 4) (Optional) Retrieve Plus Code if needed
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------

// Demo credentials (store securely in production)
const USERNAME = 'URBA00001';
const API_PASSWORD = 'fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33';

// Encode username:password into Base64 for Basic Auth
const base64Auth = btoa(`${USERNAME}:${API_PASSWORD}`);

/**
 * Create Fetch options with Basic Auth headers
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
// 3. Fetch Vehicle Status (Location via /vehicles/status)
// -----------------------------------------------------------------------------

/**
 * This function calls Cartrack's /vehicles/status endpoint.
 * If `registration` is specified, it adds `?filter[registration]=...`.
 *
 * The response typically includes `location.latitude` and `location.longitude`.
 * We'll parse them into `lat` / `lng`, plus map to local modelUrl/image if needed.
 */
export async function fetchVehicleStatus(
  registration?: string,
  retrievePlusCode?: boolean
): Promise<any> {
  try {
    // 1) Construct the URL (e.g. '.../vehicles/status?filter[registration]=ABC123')
    let url = `https://fleetapi-hk.cartrack.com/rest/vehicles/status`;
    if (registration) {
      url += `?filter[registration]=${registration}`;
    }

    // 2) Make the request
    let response = await fetch(url, getRequestOptions('GET'));
    if (!response.ok) {
      throw new Error(`fetchVehicleStatus failed: ${response.status} ${response.statusText}`);
    }
    response = await response.json();

    // 3) Optionally filter if 'registration' was provided
    if (registration && response?.data?.length) {
      response.data = response.data.filter((item: any) => item.registration === registration);
    }

    // 4) Map each vehicle's location to lat/lng & handle local assets
    if (response?.data?.length) {
      response.data = response.data.map((vehicle: any) => {
        // local asset map
        const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
        // parse lat/lng from vehicle.location
        const lat = vehicle?.location?.latitude ?? 0;
        const lng = vehicle?.location?.longitude ?? 0;

        return {
          ...vehicle,
          modelUrl,
          image,
          lat,
          lng,
        };
      });
    }

    // 5) If we want to retrieve a "plus code" for the first vehicle
    //    We can call 'retrievePlusCode(lat, lng)' here if needed
    if (
      retrievePlusCode &&
      response?.data?.length &&
      response.data[0].location
    ) {
      const plusCodeResult = await retrievePlusCode(
        response.data[0].location.latitude,
        response.data[0].location.longitude
      );
      if (plusCodeResult && plusCodeResult.status === 'OK' && plusCodeResult.plus_code) {
        // Attach plus code to first vehicle
        response.data[0].plus_code = plusCodeResult.plus_code;
      }
    }

    return response;
  } catch (error) {
    console.error('fetchVehicleStatus error:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// 4. Example: Orchestration
// -----------------------------------------------------------------------------

/**
 * Example function that retrieves status for a specific vehicle or all vehicles,
 * then logs or returns the response. Adjust as needed for your use case.
 */
export async function getVehicleStatusOrAll(registration?: string) {
  try {
    // If registration is provided, fetch that specific vehicle's status
    // Otherwise, fetch all vehicles' status
    const result = await fetchVehicleStatus(registration);
    return result;
  } catch (err) {
    console.error('getVehicleStatusOrAll error:', err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 5. (Optional) retrievePlusCode Helper
// -----------------------------------------------------------------------------

/**
 * Example function that calls some external API to get a Plus Code
 * for the given lat/lng. If you don't need plus codes, you can remove this.
 */
async function retrievePlusCode(latitude: number, longitude: number): Promise<any> {
  // For demonstration only. Replace with your actual plus code / geocoding API call.
  // e.g. https://maps.googleapis.com/maps/api/geocode/json?latlng=lat,lng&key=YOUR_KEY
  return {
    status: 'OK',
    plus_code: '8Q7X+FQ Hong Kong',
  };
}
