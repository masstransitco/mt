import {MathUtils, Vector3} from 'three';
import type {
  LatLngAltitudeLiteral,
  RaycastOptions
} from "../types/webgl"

// shorthands for math-functions, makes equations more readable
const {sin, cos, pow, sqrt, atan2, asin, sign} = Math;
const {degToRad, radToDeg, euclideanModulo} = MathUtils;

const EARTH_RADIUS_METERS = 6371008.8;

/**
 * Returns the true bearing (=compass direction) of the point from the origin.
 * @param point
 */
function getTrueBearing(point: Vector3): number {
  return euclideanModulo(90 - radToDeg(atan2(point.y, point.x)), 360);
}

/**
 * Computes the distance in meters between two coordinates using the
 * haversine formula.
 * @param from
 * @param to
 */
function distance(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral
): number {
  const {lat: latFrom, lng: lngFrom} = from;
  const {lat: latTo, lng: lngTo} = to;

  const dLat = degToRad(latTo - latFrom);
  const dLon = degToRad(lngTo - lngFrom);
  const lat1 = degToRad(latFrom);
  const lat2 = degToRad(latTo);

  const a =
    pow(sin(dLat / 2), 2) + pow(sin(dLon / 2), 2) * cos(lat1) * cos(lat2);

  return 2 * atan2(sqrt(a), sqrt(1 - a)) * EARTH_RADIUS_METERS;
}

/**
 * Computes a destination-point from a geographic origin, distance
 * and true bearing.
 * @param origin
 * @param distance
 * @param bearing
 * @param target optional target to write the result to
 */
function destination(
  origin: google.maps.LatLngLiteral,
  distance: number,
  bearing: number,
  target: google.maps.LatLngLiteral = {lat: 0, lng: 0}
): google.maps.LatLngLiteral {
  const lngOrigin = degToRad(origin.lng);
  const latOrigin = degToRad(origin.lat);

  const bearingRad = degToRad(bearing);
  const radians = distance / EARTH_RADIUS_METERS;

  const latDestination = asin(
    sin(latOrigin) * cos(radians) +
      cos(latOrigin) * sin(radians) * cos(bearingRad)
  );
  const lngDestination =
    lngOrigin +
    atan2(
      sin(bearingRad) * sin(radians) * cos(latOrigin),
      cos(radians) - sin(latOrigin) * sin(latDestination)
    );

  target.lat = radToDeg(latDestination);
  target.lng = radToDeg(lngDestination);

  return target;
}

/**
 * Samples a route to reduce the number of points to a reasonable amount
 * while ensuring key points (start, end, significant turns) are preserved.
 * 
 * @param points Array of lat/lng points representing a route
 * @returns Sampled array with fewer points for more efficient rendering/animation
 */
export function sampleRoute(points: Array<google.maps.LatLngLiteral>): Array<google.maps.LatLngLiteral> {
  if (points.length <= 20) return points;
  
  return [
    points[0], // Always include start
    ...points.filter((_, i) => i % Math.ceil(points.length / 10) === 0), // Sample middle points
    points[points.length - 1] // Always include end
  ];
}

/**
 * Calculates a camera position for viewing a route
 * @param points Array of lat/lng points representing a route
 * @returns Object with center point and suggested zoom level
 */
export function calculateRouteViewPosition(points: Array<google.maps.LatLngLiteral>): {
  center: google.maps.LatLngLiteral;
  zoom: number;
} {
  if (points.length < 1) {
    return { center: { lat: 0, lng: 0 }, zoom: 12 };
  }
  
  // For single point, just center on it
  if (points.length === 1) {
    return { center: points[0], zoom: 15 };
  }
  
  // For multiple points, calculate bounds
  const bounds = new google.maps.LatLngBounds();
  points.forEach(pt => bounds.extend(pt));
  
  // Calculate approximate center manually
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  const center = {
    lat: (ne.lat() + sw.lat()) / 2,
    lng: (ne.lng() + sw.lng()) / 2
  };
  
  // Approximate zoom calculation based on distance
  const latDistance = Math.abs(ne.lat() - sw.lat());
  const lngDistance = Math.abs(ne.lng() - sw.lng());
  const maxDistance = Math.max(latDistance, lngDistance * Math.cos(center.lat * Math.PI / 180));
  
  // Approximate zoom based on distance
  let estimatedZoom = Math.log2(360 / maxDistance);
  
  // Adjust zoom for better viewing - typically 1 level out
  const adjustedZoom = Math.max(Math.min(estimatedZoom - 1, 18), 10);
  
  return { center, zoom: adjustedZoom };
}

/**
 * Converts a point given in lat/lng or lat/lng/altitude-format to world-space coordinates.
 * @param point
 * @param reference
 * @param target optional target to write the result to
 */
export function latLngAltToVector3(
  point: LatLngAltitudeLiteral | google.maps.LatLngLiteral,
  reference: LatLngAltitudeLiteral,
  target: Vector3 = new Vector3()
): Vector3 {
  const dx = distance(reference, {lng: point.lng, lat: reference.lat});
  const dy = distance(reference, {lng: reference.lng, lat: point.lat});

  const sx = sign(point.lng - reference.lng);
  const sy = sign(point.lat - reference.lat);

  const {altitude = 0} = <LatLngAltitudeLiteral>point;

  return target.set(sx * dx, sy * dy, altitude);
}

/**
 * Converts a point given in world-space coordinates into geographic format.
 * @param point
 * @param sceneAnchor
 * @param target optional target to write the result to
 */
export function vector3ToLatLngAlt(
  point: Vector3,
  sceneAnchor: LatLngAltitudeLiteral,
  target: LatLngAltitudeLiteral = {lat: 0, lng: 0, altitude: 0}
): LatLngAltitudeLiteral {
  const distance = point.length();
  const bearing = getTrueBearing(point);

  destination(sceneAnchor, distance, bearing, target);
  target.altitude = point.z;

  return target;
}
