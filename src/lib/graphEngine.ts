// ============================================================================
// DEPREM-AI — Faz 3: Graph Engine (Katman 2 — GNN Proxy)
// Dynamic road network with damage-based edge weighting
// Uses spatial hashing for O(n) edge creation instead of O(n²)
// ============================================================================

import { GraphNode, GraphEdge, RoadGraph, ScannedBuilding } from './types';

const EDGE_RADIUS_KM = 1.5;
const SPATIAL_CELL_SIZE = 0.015; // ~1.5km in degrees at Istanbul's latitude

/**
 * Generate a road graph from building positions using spatial hashing.
 * Creates a grid-like network connecting nearby buildings as intersections.
 */
export function generateRoadGraph(buildings: ScannedBuilding[]): RoadGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  // Sample buildings for graph nodes (every 10th)
  const graphBuildings = buildings.filter((_, i) => i % 10 === 0);

  // Create nodes
  graphBuildings.forEach((b) => {
    nodes.set(b.id, {
      id: b.id,
      lat: b.lat,
      lng: b.lng,
      edges: [],
    });
  });

  // Spatial hash for O(n) neighbor lookup instead of O(n²)
  const spatialHash = new Map<string, GraphNode[]>();
  const nodeArray = Array.from(nodes.values());

  for (const node of nodeArray) {
    const cellKey = `${Math.floor(node.lat / SPATIAL_CELL_SIZE)}_${Math.floor(node.lng / SPATIAL_CELL_SIZE)}`;
    if (!spatialHash.has(cellKey)) spatialHash.set(cellKey, []);
    spatialHash.get(cellKey)!.push(node);
  }

  // Connect nodes within proximity using spatial hash
  for (const node of nodeArray) {
    const cellX = Math.floor(node.lat / SPATIAL_CELL_SIZE);
    const cellY = Math.floor(node.lng / SPATIAL_CELL_SIZE);

    // Check neighboring cells (3x3 grid)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${cellX + dx}_${cellY + dy}`;
        const cellNodes = spatialHash.get(neighborKey);
        if (!cellNodes) continue;

        for (const neighbor of cellNodes) {
          if (neighbor.id <= node.id) continue; // Avoid duplicates

          const dist = haversineKm(node.lat, node.lng, neighbor.lat, neighbor.lng);
          if (dist < EDGE_RADIUS_KM) {
            const edgeId = `${node.id}-${neighbor.id}`;
            edges.set(edgeId, {
              id: edgeId,
              from: node.id,
              to: neighbor.id,
              distance: dist,
              weight: dist,
              blocked: false,
            });
            node.edges.push(edgeId);
            neighbor.edges.push(edgeId);
          }
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Update edge weights based on nearby building damage.
 * Simulates GNN message-passing: damaged buildings increase nearby road weights.
 * Uses spatial hashing for efficient nearby-building lookup.
 */
export function updateEdgeWeights(
  graph: RoadGraph,
  buildings: ScannedBuilding[]
): void {
  // Build spatial hash for buildings
  const buildingHash = new Map<string, ScannedBuilding[]>();
  const cellSize = 0.003; // ~300m cells

  for (const b of buildings) {
    if (!b.scanned) continue;
    const key = `${Math.floor(b.lat / cellSize)}_${Math.floor(b.lng / cellSize)}`;
    if (!buildingHash.has(key)) buildingHash.set(key, []);
    buildingHash.get(key)!.push(b);
  }

  graph.edges.forEach((edge) => {
    const fromNode = graph.nodes.get(edge.from);
    const toNode = graph.nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    // Find midpoint of edge
    const midLat = (fromNode.lat + toNode.lat) / 2;
    const midLng = (fromNode.lng + toNode.lng) / 2;

    const cellX = Math.floor(midLat / cellSize);
    const cellY = Math.floor(midLng / cellSize);

    // Check nearby buildings using spatial hash (3x3 around midpoint)
    let damageImpact = 0;
    let blockCount = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellKey = `${cellX + dx}_${cellY + dy}`;
        const cellBuildings = buildingHash.get(cellKey);
        if (!cellBuildings) continue;

        for (const b of cellBuildings) {
          const dist = haversineKm(midLat, midLng, b.lat, b.lng);
          if (dist < 0.3) {
            damageImpact += b.damageScore * (1 - dist / 0.3);
            if (b.damageCategory === 'YIKIK') blockCount++;
          }
        }
      }
    }

    // Weight = base distance × (1 + damage multiplier)
    const damageMultiplier = Math.min(damageImpact * 0.8, 5.0);
    edge.weight = edge.distance * (1 + damageMultiplier);

    // Block road if multiple collapsed buildings nearby
    edge.blocked = blockCount >= 2;
    if (edge.blocked) edge.weight = Infinity;
  });
}

/**
 * Find the nearest graph node to a given coordinate
 */
export function findNearestNodeId(
  graph: RoadGraph,
  lat: number,
  lng: number,
  maxDistanceKm = 2.0
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

  return nearestDist <= maxDistanceKm ? nearestId : null;
}

/**
 * A* pathfinding on the road graph.
 * Returns array of node IDs representing the path, or empty if unreachable.
 */
export function aStarPath(
  graph: RoadGraph,
  startId: string,
  goalId: string
): string[] {
  const startNode = graph.nodes.get(startId);
  const goalNode = graph.nodes.get(goalId);
  if (!startNode || !goalNode) return [];

  const openSet = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startId, 0);
  fScore.set(startId, haversineKm(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng));

  while (openSet.size > 0) {
    // Get node with lowest fScore
    let current = '';
    let currentF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = id;
      }
    }

    if (current === goalId) {
      // Reconstruct path
      const path = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)!;
        path.unshift(c);
      }
      return path;
    }

    openSet.delete(current);
    const node = graph.nodes.get(current);
    if (!node) break;

    for (const edgeId of node.edges) {
      const edge = graph.edges.get(edgeId);
      if (!edge || edge.blocked) continue;

      const neighborId = edge.from === current ? edge.to : edge.from;
      const tentativeG = (gScore.get(current) ?? Infinity) + edge.weight;

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);

        const neighborNode = graph.nodes.get(neighborId);
        const h = neighborNode
          ? haversineKm(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng)
          : 0;
        fScore.set(neighborId, tentativeG + h);

        openSet.add(neighborId);
      }
    }
  }

  return []; // No path found
}

/**
 * Get the route as lat/lng coordinates from a path of node IDs
 */
export function pathToCoordinates(
  graph: RoadGraph,
  path: string[]
): [number, number][] {
  return path
    .map((id) => {
      const node = graph.nodes.get(id);
      return node ? [node.lat, node.lng] as [number, number] : null;
    })
    .filter((c): c is [number, number] => c !== null);
}

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { haversineKm };
