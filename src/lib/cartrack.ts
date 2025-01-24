/**
 * src/lib/cartrack.ts
 * 
 * Demonstrates:
 * 1) Fetching the vehicle list from Cartrack
 * 2) Optionally mapping each vehicle to local .glb/.png assets
 * 3) (Optional) Fetching nearest vehicles
 * 
 * Adjust to your actual needs.
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------

const USERNAME = 'URBA00001';
const API_PASSWORD = 'fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33';

const base64Auth = btoa(`${USERNAME}:${API_PASSWORD}`);

/** Shared function to build fetch options with Basic Auth headers */
function getFetchOptions(method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): RequestInit {
  const headers = new Headers();
  headers.append('Authorization', `Basic ${base64Auth}`);
  headers.append('Content-Type', 'application/json');

  return {
    method,
    headers,
    redirect: 'manual', // or 'follow', based on your preference
  };
}

// -----------------------------------------------------------------------------
// 2. OPTIONAL: MAPPING CARTRACK VEHICLE TO LOCAL ASSETS
// -----------------------------------------------------------------------------

// Example map: registration => local .glb/.png
const LOCAL_ASSETS_MAP: Record<string, { modelUrl: string; image: string }> = {
  // e.g., Cartrack vehicle with registration "ABC123" uses local "car1" 
  // Adjust or add more as needed
  ABC123: {
    modelUrl: '/cars/car1.glb',
    image: '/cars/car1.png',
  },
};

/**
 * Returns local asset paths for a given vehicle registration.
 * Fallback to some default if not found.
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
// 3. Fetch Vehicle List (with optional transform to local assets)
// -----------------------------------------------------------------------------
/**
 * Fetches a list of vehicles from Cartrack.
 * Endpoint: GET /vehicles
 *
 * @returns An array of objects with local modelUrl & image
 */
export async function fetchVehicleList(): Promise<any[]> {
  const url = 'https://fleetapi-hk.cartrack.com/rest/vehicles';
  const response = await fetch(url, getFetchOptions('GET'));

  if (!response.ok) {
    throw new Error(`fetchVehicleList failed: ${response.status} ${response.statusText}`);
  }

  // Cartrack typically returns { data: [...], meta: {...} }
  const result = await response.json();
  const rawVehicles = result.data || [];

  // OPTIONAL: Transform raw Cartrack vehicles to include local modelUrl/image
  // e.g., map registration => local .glb / .png
  const transformed = rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);

    return {
      ...vehicle,
      modelUrl, // from local assets
      image,    // from local assets
    };
  });

  return transformed;
}

// -----------------------------------------------------------------------------
// 4. Fetch Nearest Vehicles
// -----------------------------------------------------------------------------
/**
 * Fetches vehicles nearest to a given lat/long within an optional max distance.
 * Endpoint: GET /vehicles/nearest?longitude=...&latitude=...
 */
export async function fetchVehiclesNearestToPoint(
  longitude: number,
  latitude: number,
  maxDistance?: number,
  includeRegistrations?: string,
  excludeRegistrations?: string
): Promise<any[]> {
  const baseUrl = 'https://fleetapi-hk.cartrack.com/rest/vehicles/nearest';
  const params = new URLSearchParams();
  params.set('longitude', longitude.toString());
  params.set('latitude', latitude.toString());

  if (maxDistance !== undefined) {
    params.set('filter[max_distance]', maxDistance.toString());
  }
  if (includeRegistrations) {
    params.set('filter[include_many_registrations]', includeRegistrations);
  }
  if (excludeRegistrations) {
    params.set('filter[exclude_many_registrations]', excludeRegistrations);
  }

  const url = `${baseUrl}?${params.toString()}`;
  const response = await fetch(url, getFetchOptions('GET'));

  if (!response.ok) {
    throw new Error(`fetchVehiclesNearestToPoint failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const rawVehicles = result.data || [];

  // OPTIONAL: incorporate local assets
  const transformed = rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);

    return {
      ...vehicle,
      modelUrl,
      image,
    };
  });
  return transformed;
}

// -----------------------------------------------------------------------------
// 5. Example: Orchestrate Both Calls
// -----------------------------------------------------------------------------
/**
 * Example function to:
 *  1) Fetch the full vehicle list
 *  2) Fetch vehicles nearest a given lat/long
 *  3) Combine or process the data as needed
 */
export async function getVehiclesAndLocations() {
  try {
    // 1) Get the full vehicle list
    const allVehicles = await fetchVehicleList();

    // 2) Get the nearest vehicles to some point
    const nearestVehicles = await fetchVehiclesNearestToPoint(103.123456, 1.345877);

    // 3) Optionally parse out positions
    const positions = nearestVehicles.map((vehicle: any) => ({
      id: vehicle.id,
      registration: vehicle.registration,
      lat: vehicle.last_position?.lat ?? 0,
      lng: vehicle.last_position?.lng ?? 0,
    }));

    return {
      allVehicles,
      nearestVehicles,
      positions,
    };
  } catch (err) {
    console.error('getVehiclesAndLocations error:', err);
    throw err;
  }
}
