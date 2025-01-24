/**
 * src/lib/cartrack.ts
 *
 * Combines:
 * 1) Basic Auth Setup
 * 2) Local Asset Mapping
 * 3) Fetch Vehicle List (with optional filters)
 * 4) Fetch Nearest Vehicles
 * 5) Example Orchestration
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

const LOCAL_ASSETS_MAP: Record<string, { modelUrl: string; image: string }> = {
  // Example: If Cartrack vehicle has registration "ABC123", show these local assets
  ABC123: {
    modelUrl: '/cars/car1.glb',
    image: '/cars/car1.png',
  },
};

/**
 * Return local asset paths for a given registration
 * If not found, fallback to some default
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
// 3. Fetch Vehicle List with Optional Filters
// -----------------------------------------------------------------------------

/**
 * Possible query filters for GET /vehicles
 * (Adjust to match Cartrack docs: filter[colour], filter[chassis_number], etc.)
 */
export interface FetchVehicleListParams {
  vehicle_id?: number;
  registration?: string; 
  manufacturer?: string; 
  model_year?: number; 
  // Add page, limit, etc. if needed
}

/**
 * Fetches a list of vehicles from Cartrack
 * Endpoint: GET /vehicles?filter[vehicle_id]=...&filter[registration]=... etc.
 *
 * 1) Applies optional filters to the query
 * 2) Maps each vehicle to local assets
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
  // e.g., if you want filter[colour], filter[chassis_number], page, limit, etc., add them here

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

  // OPTIONAL: Transform raw Cartrack vehicles to include local modelUrl/image
  return rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
    return {
      ...vehicle,
      modelUrl,
      image,
    };
  });
}

// -----------------------------------------------------------------------------
// 4. Fetch Nearest Vehicles
// -----------------------------------------------------------------------------

/**
 * Fetches vehicles nearest to a given lat/long
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

  // Required lat/lng
  params.set('longitude', longitude.toString());
  params.set('latitude', latitude.toString());

  // Optional radius in meters
  if (maxDistance !== undefined) {
    params.set('filter[max_distance]', maxDistance.toString());
  }
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

  // OPTIONAL: incorporate local assets
  return rawVehicles.map((vehicle: any) => {
    const { modelUrl, image } = getLocalAssetsForRegistration(vehicle.registration);
    return {
      ...vehicle,
      modelUrl,
      image,
    };
  });
}

// -----------------------------------------------------------------------------
// 5. Example: Orchestrate Both Calls
// -----------------------------------------------------------------------------
/**
 * Example function demonstrating:
 * 1) Fetch the full vehicle list (no or minimal filters)
 * 2) Fetch vehicles nearest to a lat/long
 * 3) Combine or process the results
 */
export async function getVehiclesAndLocations() {
  try {
    // 1) Get the full vehicle list
    const allVehicles = await fetchVehicleList(); 
    // or pass filters: fetchVehicleList({ registration: 'GRG123' })

    // 2) Get the nearest vehicles to some point
    const nearestVehicles = await fetchVehiclesNearestToPoint(103.123456, 1.345877);

    // 3) Example parse: extract IDs, positions, etc.
    const positions = nearestVehicles.map((v: any) => ({
      id: v.id,
      registration: v.registration,
      lat: v.last_position?.lat ?? 0,
      lng: v.last_position?.lng ?? 0,
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
