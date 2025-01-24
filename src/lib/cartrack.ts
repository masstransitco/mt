/**
 * src/lib/cartrack.ts
 *
 * Demonstrates:
 * 1) Fetching the vehicle list
 * 2) Fetching vehicles nearest to a point (latitude/longitude)
 * 3) Optionally merging the data to extract lat/long
 */

// -----------------------------------------------------------------------------
// 1. Basic Auth Setup
// -----------------------------------------------------------------------------

// Hardcoded credentials for demonstration. Store them securely in production!
const USERNAME = 'URBA00001';
const API_PASSWORD = 'fd58cd26fefc8c2b2ba1f7f52b33221a65f645790a43ff9b8da35db7da6e1f33';

// Encode username:password in Base64
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
// 2. Fetch Vehicle List
// -----------------------------------------------------------------------------
/**
 * Fetches a list of vehicles from Cartrack.
 * Endpoint: GET /vehicles
 *
 * @returns An array of vehicle objects (raw from Cartrack).
 */
export async function fetchVehicleList(): Promise<any[]> {
  const url = 'https://fleetapi-hk.cartrack.com/rest/vehicles';
  const response = await fetch(url, getFetchOptions('GET'));

  if (!response.ok) {
    throw new Error(`fetchVehicleList failed: ${response.status} ${response.statusText}`);
  }

  // Cartrack typically returns { data: [...], meta: {...} }
  const result = await response.json();
  return result.data || [];
}

// -----------------------------------------------------------------------------
// 3. Fetch Nearest Vehicles
// -----------------------------------------------------------------------------
/**
 * Fetches vehicles nearest to a given lat/long within an optional max distance.
 * Endpoint: GET /vehicles/nearest?longitude=...&latitude=...
 *
 * @param longitude   The longitude
 * @param latitude    The latitude
 * @param maxDistance Optional radius in meters (default = 100)
 * @param includeRegistrations  Comma-separated registrations to include
 * @param excludeRegistrations  Comma-separated registrations to exclude
 * @returns An array of vehicle objects near the specified point.
 */
export async function fetchVehiclesNearestToPoint(
  longitude: number,
  latitude: number,
  maxDistance?: number,
  includeRegistrations?: string,
  excludeRegistrations?: string
): Promise<any[]> {
  // Build query params
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

  // Cartrack might return { data: [...], meta: {...} }
  const result = await response.json();
  return result.data || [];
}

// -----------------------------------------------------------------------------
// 4. Example: Orchestrate Both Calls
// -----------------------------------------------------------------------------
/**
 * Example function to:
 *  1) Fetch the full vehicle list
 *  2) Fetch vehicles nearest a given lat/long
 *  3) Combine or process the data as needed (e.g., extracting lat/long)
 *
 * Adjust to your specific logic or needs.
 */
export async function getVehiclesAndLocations() {
  try {
    // 1) Get the full vehicle list
    const allVehicles = await fetchVehicleList();

    // 2) Get the nearest vehicles to some point
    //    Hard-coded example lat/long from doc snippet: lat=1.345877, lng=103.123456
    const nearestVehicles = await fetchVehiclesNearestToPoint(103.123456, 1.345877);

    // If you want to see just lat/long from the "nearest" call:
    // The doc's sample data may look like:
    //    {
    //       id: 12345,
    //       registration: 'ABC123',
    //       last_position: { lat: 1.345877, lng: 103.123456 },
    //       ...
    //    }
    // Adjust parsing as needed.
    const positions = nearestVehicles.map((vehicle: any) => {
      return {
        id: vehicle.id,
        registration: vehicle.registration,
        // e.g., if Cartrack returns last known position in .last_position
        lat: vehicle.last_position?.lat ?? 0,
        lng: vehicle.last_position?.lng ?? 0,
      };
    });

    // Combine data or return it
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
