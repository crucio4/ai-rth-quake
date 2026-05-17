// ============================================================================
// DEPREM-AI — Faz 4: Route Optimizer (Katman 3 — MARL Proxy)
// Rule-based multi-agent task assignment with A* routing
// ============================================================================

import { ScannedBuilding, RescueTeam, RoadGraph } from './types';
import { aStarPath, pathToCoordinates, haversineKm } from './graphEngine';

/** Average rescue team speed in km/h (urban post-earthquake conditions) */
const TEAM_SPEED_KMH = 25;

/**
 * Assign the next target building to an idle team.
 * Uses a greedy reward proxy: score = priorityScore / (distance + 1)
 * Prevents conflicts: no two teams can target the same building.
 */
export function assignTarget(
  team: RescueTeam,
  buildings: ScannedBuilding[],
  teams: RescueTeam[],
  graph: RoadGraph
): { targetId: string | null; route: [number, number][]; eta: number } {
  // Get buildings that are damaged, scanned, not yet assigned
  const candidates = buildings.filter(
    (b) =>
      b.scanned &&
      !b.assigned &&
      (b.damageCategory === 'YIKIK' || b.damageCategory === 'AGIR' || b.damageCategory === 'ORTA') &&
      !teams.some((t) => t.targetBuildingId === b.id && t.id !== team.id)
  );

  if (candidates.length === 0) {
    return { targetId: null, route: [], eta: 0 };
  }

  // Score each candidate: reward = priorityScore / (distance + 0.5)
  let bestScore = -1;
  let bestCandidate: ScannedBuilding | null = null;

  for (const candidate of candidates) {
    const dist = haversineKm(team.lat, team.lng, candidate.lat, candidate.lng);
    const reward = candidate.priorityScore / (dist + 0.5);
    if (reward > bestScore) {
      bestScore = reward;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return { targetId: null, route: [], eta: 0 };
  }

  // Try to find graph-based route
  const nearestStartNode = findNearestNode(graph, team.lat, team.lng);
  const nearestGoalNode = findNearestNode(graph, bestCandidate.lat, bestCandidate.lng);

  let route: [number, number][] = [];
  let routeDistance = haversineKm(team.lat, team.lng, bestCandidate.lat, bestCandidate.lng);

  if (nearestStartNode && nearestGoalNode) {
    const path = aStarPath(graph, nearestStartNode, nearestGoalNode);
    if (path.length > 0) {
      route = [
        [team.lat, team.lng],
        ...pathToCoordinates(graph, path),
        [bestCandidate.lat, bestCandidate.lng],
      ];
      // Calculate actual route distance
      routeDistance = 0;
      for (let i = 1; i < route.length; i++) {
        routeDistance += haversineKm(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]);
      }
    } else {
      // Fallback: direct line
      route = [
        [team.lat, team.lng],
        [bestCandidate.lat, bestCandidate.lng],
      ];
    }
  } else {
    route = [
      [team.lat, team.lng],
      [bestCandidate.lat, bestCandidate.lng],
    ];
  }

  const eta = (routeDistance / TEAM_SPEED_KMH) * 60; // minutes

  return { targetId: bestCandidate.id, route, eta: Math.round(eta * 10) / 10 };
}

/**
 * Find the nearest graph node to a given coordinate
 */
function findNearestNode(
  graph: RoadGraph,
  lat: number,
  lng: number
): string | null {
  let nearestId: string | null = null;
  let nearestDist = Infinity;

  graph.nodes.forEach((node) => {
    const dist = haversineKm(lat, lng, node.lat, node.lng);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = node.id;
    }
  });

  return nearestDist < 2.0 ? nearestId : null; // Only if within 2km
}

/**
 * Create initial rescue teams positioned around the city
 */
export function createInitialTeams(): RescueTeam[] {
  const teamColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
  const teamNames = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo'];

  // Positioned around Besiktas (near staging areas conceptually)
  const positions: [number, number][] = [
    [41.043, 29.005], // Besiktas Merkez
    [41.058, 29.012], // Ulus
    [41.049, 29.029], // Ortakoy
    [41.066, 29.001], // Levent
    [41.036, 29.015], // Dikilitas
  ];

  return positions.map((pos, i) => ({
    id: `team-${i}`,
    name: `Ekip ${teamNames[i]}`,
    lat: pos[0],
    lng: pos[1],
    targetBuildingId: null,
    route: [],
    status: 'idle' as const,
    color: teamColors[i],
    rescuedCount: 0,
    eta: 0,
  }));
}
