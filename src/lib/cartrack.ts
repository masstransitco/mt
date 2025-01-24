/**
 * src/lib/cartrack.ts
 *
 * Combines:
 * 1) Basic Auth Setup
 * 2) Local Asset Mapping
 * 3) Fetch Vehicle List (with optional filters)
 * 4) Fetch Nearest Vehicles (with 50km default radius)
 * 5) Example Orchestration
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
 * Helper to create Fetch options with Basic Auth headers
 */
function getFetchOptions(method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): RequestInit {
  const headers = new Headers();
  headers.append('Authorization', `Basic ${base64Auth}`);
  headers.append('Content-Type', 'application/json');

  return {
    method,
    headers,
    redirect: 'manual', // or 'follow'
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
  // Example: If Cartrack vehicle has registration "ABC123", it uses local assets
  ABC123: {
    modelUrl: '/cars/car1.glb',
    image: '/cars/car1.png',
  },
};

/**
 * Return local asset paths for a given registration.
 * If not found, fallback to defaultModel.glb / defaultImage.png
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
  // Fallback
  return {
    modelUrl: '/cars/defaultModel.glb',
    image: '/cars/defaultImage.png',
  };
}

// -----------------------------------------------------------------------------
// 3. Fetch Vehicle List with Optional Filters
// -----------------------------------------------------------------------------

/**
 * Possible query filters for GET /vehicles
 * (e.g. filter[colour], filter[chassis_number], page, limit, etc. as needed)
 */
export interface FetchVehicleListParams {
  vehicle_id?: number;
  registration?: string;
  manufacturer?: string;
  model_year?: number;
  // Add page, limit, etc. if needed
}

/**
 * Fetches a list of vehicles from Cartrack.
 * Endpoint: GET /vehicles?filter[vehicle_id]=...&filter[registration]=... etc.
 *
 * 1) Applies optional filters to the query
 * 2) Enriches each vehicle with local model/image
 * 3) Extracts lat/long from last_position if available
 * @returns Array of transformed vehicles
 */
export async function fetchVehicleList(filters: FetchVehicleListParams = {}): Promise<any[]> {
  const baseUrl = 'https://fleetapi-hk.cartrack.com/rest/vehicles';
  const params = new URLSearchParams();

  // Build Cartrack filters if provided
  if (filters.vehicle_id !== undefined) {
    params.set('filter[vehicle_id]', filters.vehicle_id.toString());
  }
  if (filters.registration) {
    params.set('filter[registration]', filters.registration);
  }
  if (filters.manufacturer) {
    params.set('filter[manufacturer]', filters.manufacturer);
  }
  if (filters.model_year !== undefined) {
    params.set('filter[model_year]', filters.model_year.toString());
  }

  // Construct final URL
  const finalUrl = params.toString() ? `${baseUrl}?${params}` : baseUrl;

  // Fetch with Basic Auth
  const response = await fetch(finalUrl, getFetchOptions('GET'));
  if (!response.ok) {
    throw new Error(`fetchVehicleList failed: ${response.status} ${response.statusText}`);
  }

  // Cartrack typically returns { data: [...], meta: {...} }
  const result = await response.json();
  const rawVehicles = result.data || [];

  // Extract lat/long + local assets
  return rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
    const lat = vehicle.last_position?.lat ?? 0;
    const lng = vehicle.last_position?.lng ?? 0;

    return {
      ...vehicle,
      modelUrl,
      image,
      lat,
      lng,
    };
  });
}

// -----------------------------------------------------------------------------
// 4. Fetch Nearest Vehicles (default 50km radius)
// -----------------------------------------------------------------------------

/**
 * Fetches vehicles nearest to a given lat/long
 * Endpoint: GET /vehicles/nearest?longitude=...&latitude=...
 *
 * By default, we set filter[max_distance] to 50000 (50km).
 * Adjust as needed to encompass your entire region.
 */
export async function fetchVehiclesNearestToPoint(
  longitude: number,
  latitude: number,
  maxDistance = 50000, // 50km radius
  includeRegistrations?: string,
  excludeRegistrations?: string
): Promise<any[]> {
  const baseUrl = 'https://fleetapi-hk.cartrack.com/rest/vehicles/nearest';
  const params = new URLSearchParams();

  // Required lat/lng
  params.set('longitude', longitude.toString());
  params.set('latitude', latitude.toString());

  // Optional radius in meters
  params.set('filter[max_distance]', maxDistance.toString());

  // Optionally include or exclude certain registrations
  if (includeRegistrations) {
    params.set('filter[include_many_registrations]', includeRegistrations);
  }
  if (excludeRegistrations) {
    params.set('filter[exclude_many_registrations]', excludeRegistrations);
  }

  const finalUrl = `${baseUrl}?${params.toString()}`;
  const response = await fetch(finalUrl, getFetchOptions('GET'));
  if (!response.ok) {
    throw new Error(
      `fetchVehiclesNearestToPoint failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  const rawVehicles = result.data || [];

  // Extract lat/long + local assets
  return rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
    const lat = vehicle.last_position?.lat ?? 0;
    const lng = vehicle.last_position?.lng ?? 0;

    return {
      ...vehicle,
      modelUrl,
      image,
      lat,
      lng,
    };
  });
}

// -----------------------------------------------------------------------------
// 5. Example: Orchestrate Both Calls
// -----------------------------------------------------------------------------

/**
 * Example function demonstrating:
 * 1) Fetch the full vehicle list (no or minimal filters)
 * 2) Fetch vehicles nearest to a lat/long with a large radius
 * 3) Combine or process the results
 *
 * If your vehicles truly have positions in Cartrack, and
 * they're within 50km of (114.0, 22.3), you'll see lat/lng > 0.
 */
export async function getVehiclesAndLocations() {
  try {
    // 1) Get the full vehicle list
    const allVehicles = await fetchVehicleList();

    // 2) Get the nearest vehicles to lat=22.3, lng=114.0 within 50km
    const nearestVehicles = await fetchVehiclesNearestToPoint(114.0, 22.3, 50000);

    // Return them for further use
    return {
      allVehicles,
      nearestVehicles,
    };
  } catch (err) {
    console.error('getVehiclesAndLocations error:', err);
    throw err;
  }
}
