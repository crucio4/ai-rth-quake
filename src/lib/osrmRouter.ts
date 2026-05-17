// ============================================================================
// DEPREM-AI — OSRM Router (Open Source Routing Machine)
// Uses the free OSRM demo server for real road-following routes
// Returns actual duration & distance from OSRM alongside the geometry
// ============================================================================

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export interface OSRMRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

/**
 * Fetch a real driving route between two points using OSRM.
 * Returns array of [lat, lng] coordinates following actual roads,
 * plus the OSRM-computed distance (km) and duration (minutes).
 *
 * @param from [lng, lat] — OSRM uses lng,lat order
 * @param to   [lng, lat]
 */
export async function fetchOSRMRoute(
  from: [number, number],
  to: [number, number]
): Promise<OSRMRouteResult> {
  return fetchOSRMRouteWithWaypoints([from, to]);
}

/**
 * Fetch a real driving route between multiple points using OSRM.
 * Points are [lng, lat] in OSRM order.
 */
export async function fetchOSRMRouteWithWaypoints(
  points: [number, number][]
): Promise<OSRMRouteResult> {
  try {
    if (points.length < 2) return emptyResult();

    const path = points.map((p) => `${p[0]},${p[1]}`).join(';');
    const url = `${OSRM_BASE}/${path}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return emptyResult();

    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return emptyResult();
    }

    const route = data.routes[0];

    // OSRM returns [lng, lat], we need [lat, lng] for Leaflet
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
    );

    return {
      coordinates,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(route.duration / 60),
    };
  } catch (error) {
    console.warn('OSRM route fetch failed, using direct line:', error);
    return emptyResult();
  }
}

function emptyResult(): OSRMRouteResult {
  return { coordinates: [], distanceKm: 0, durationMinutes: 0 };
}

/**
 * Batch route fetching for multiple team-building pairs.
 * Respects OSRM rate limiting with sequential requests.
 */
export async function fetchMultipleRoutes(
  pairs: { from: [number, number]; to: [number, number]; teamId: string }[]
): Promise<Map<string, OSRMRouteResult>> {
  const results = new Map<string, OSRMRouteResult>();

  for (const pair of pairs) {
    const result = await fetchOSRMRoute(pair.from, pair.to);
    results.set(pair.teamId, result);
    // Small delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
