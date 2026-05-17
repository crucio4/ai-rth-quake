// ============================================================================
// DEPREM-AI — Zustand Store v4
// Progressive loading with batched processing, OSRM real data, missions
// ============================================================================

import { create } from 'zustand';
import {
  RawBuilding, ScannedBuilding, RescueTeam, RoadGraph, Metrics,
  SimulationState, EmergencyCenter, RescueMission,
} from '../lib/types';
import {
  fetchBuildings, damageScoreToCategory, initScannedBuilding,
  processBuildingsBatched, calculatePreSearchPriorityScore, calculateRescuePriorityScore,
} from '../lib/dataParser';
import { runCVPipeline } from '../lib/mockCV';
import { aStarPath, generateRoadGraph, pathToCoordinates, updateEdgeWeights, findNearestNodeId } from '../lib/graphEngine';
import { ISTANBUL_EMERGENCY_CENTERS } from '../lib/emergencyCenters';
import { fetchOSRMRoute, fetchOSRMRouteWithWaypoints } from '../lib/osrmRouter';

export interface PriorityZone {
  id: string;
  center: [number, number];
  radius: number;
  level: 'critical' | 'high' | 'medium';
  buildingCount: number;
  yikikCount: number;
  avgPriority: number;
}

interface QuakeStore {
  buildings: ScannedBuilding[];
  emergencyCenters: EmergencyCenter[];
  missions: RescueMission[];
  teams: RescueTeam[];
  graph: RoadGraph | null;
  metrics: Metrics;
  simulation: SimulationState;
  priorityZones: PriorityZone[];

  // UI state
  dataReady: boolean;
  loadingProgress: number; // 0-100
  selectedCenter: string | null;
  selectedBuilding: string | null;
  routingMode: boolean;
  showBeforeAfter: boolean;
  dispatchLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSpeed: (speed: number) => void;
  tick: () => void;

  // Dispatch
  selectCenter: (id: string | null) => void;
  selectBuilding: (id: string | null) => void;
  toggleRoutingMode: () => void;
  toggleBeforeAfter: () => void;
  dispatchMission: (centerId: string, buildingId: string, safeRoute: boolean) => Promise<void>;
  clearMissions: () => void;
}

const emptyMetrics: Metrics = {
  totalBuildings: 0, scannedCount: 0, yikikCount: 0, agirCount: 0, ortaCount: 0,
  hafifCount: 0, saglamCount: 0, rescuedCount: 0, activeTeams: 0, avgEta: 0,
  estimatedLivesSaved: 0, responseImprovement: 0, elapsedMinutes: 0, activeMissions: 0,
};

export const useQuakeStore = create<QuakeStore>((set, get) => ({
  buildings: [],
  emergencyCenters: ISTANBUL_EMERGENCY_CENTERS,
  missions: [],
  teams: [],
  graph: null,
  metrics: { ...emptyMetrics },
  simulation: { elapsedMinutes: 0, running: false, speed: 1, scenario: 'Beşiktaş Senaryosu' },
  priorityZones: [],
  dataReady: false,
  loadingProgress: 0,
  selectedCenter: null,
  selectedBuilding: null,
  routingMode: false,
  showBeforeAfter: false,
  dispatchLoading: false,

  initialize: async () => {
    // Prevent double init
    if (get().dataReady || get().loadingProgress > 0) return;

    try {
      set({ loadingProgress: 5 });

      const rawBuildings: RawBuilding[] = await fetchBuildings();
      set({ loadingProgress: 25 });

      // Process buildings in async batches (won't block UI)
      const buildings = await processBuildingsBatched(
        rawBuildings,
        (b) => {
          const hasPostDamageScore = Number.isFinite(b.postDamageScore);
          const damageScore = hasPostDamageScore ? (b.postDamageScore as number) : runCVPipeline(b).damageScore;
          const damageCategory = b.postDamageCategory ?? damageScoreToCategory(damageScore);
          const preSearchPriorityScore = Number.isFinite(b.preSearchPriorityScore)
            ? (b.preSearchPriorityScore as number)
            : calculatePreSearchPriorityScore(b);
          const priorityScore = calculateRescuePriorityScore(b, damageScore);
          return {
            ...initScannedBuilding(b),
            damageScore,
            damageCategory,
            priorityScore,
            preSearchPriorityScore,
            scanned: true,
          };
        },
        500,
        (processed, total) => {
          set({ loadingProgress: 25 + Math.round((processed / total) * 50) });
        }
      );

      set({ loadingProgress: 80 });

      // Generate graph (lighter with sampled data)
      const graph = generateRoadGraph(buildings);
      updateEdgeWeights(graph, buildings);
      set({ loadingProgress: 90 });

      const priorityZones = computePriorityZones(buildings);
      const metrics = computeMetrics(buildings, [], 0, 0);

      set({ buildings, graph, priorityZones, metrics, dataReady: true, loadingProgress: 100 });
    } catch (error) {
      console.error('Init failed:', error);
      set({ loadingProgress: 0 });
    }
  },

  startSimulation: () => set((s) => ({ simulation: { ...s.simulation, running: true } })),
  pauseSimulation: () => set((s) => ({ simulation: { ...s.simulation, running: false } })),
  setSpeed: (speed) => set((s) => ({ simulation: { ...s.simulation, speed } })),

  resetSimulation: () => {
    set((s) => ({
      missions: [],
      simulation: { ...s.simulation, elapsedMinutes: 0, running: false },
      metrics: computeMetrics(s.buildings, [], 0, 0),
    }));
  },

  selectCenter: (id) => set({ selectedCenter: id }),
  selectBuilding: (id) => set({ selectedBuilding: id }),
  toggleRoutingMode: () => set((s) => ({ routingMode: !s.routingMode })),
  toggleBeforeAfter: () => set((s) => ({ showBeforeAfter: !s.showBeforeAfter })),

  dispatchMission: async (centerId: string, buildingId: string, safeRoute: boolean) => {
    const state = get();
    const center = state.emergencyCenters.find((c) => c.id === centerId);
    const building = state.buildings.find((b) => b.id === buildingId);
    if (!center || !building) return;

    set({ dispatchLoading: true });

    let osrmResult = null as Awaited<ReturnType<typeof fetchOSRMRoute>> | null;

    if (safeRoute && state.graph) {
      const waypoints = getSafeRouteWaypoints(state.graph, center.lat, center.lng, building.lat, building.lng);
      if (waypoints.length > 0) {
        const osrmPoints: [number, number][] = [
          [center.lng, center.lat],
          ...waypoints.map(([lat, lng]) => [lng, lat] as [number, number]),
          [building.lng, building.lat],
        ];
        osrmResult = await fetchOSRMRouteWithWaypoints(osrmPoints);
        if (osrmResult.coordinates.length === 0) osrmResult = null;
      }
    }

    if (!osrmResult) {
      osrmResult = await fetchOSRMRoute(
        [center.lng, center.lat],
        [building.lng, building.lat]
      );
    }

    const route: [number, number][] = osrmResult.coordinates.length > 0
      ? osrmResult.coordinates
      : [[center.lat, center.lng], [building.lat, building.lng]];

    // Use OSRM-provided distance/duration if available, fallback to haversine
    const distance = osrmResult.distanceKm > 0
      ? osrmResult.distanceKm
      : haversineKm(center.lat, center.lng, building.lat, building.lng);

    const duration = osrmResult.durationMinutes > 0
      ? osrmResult.durationMinutes
      : Math.round((distance / 30) * 60);

    const mission: RescueMission = {
      id: `mission-${Date.now()}`,
      fromCenter: centerId,
      toBuildingId: buildingId,
      route,
      routeDistance: distance,
      routeDuration: duration,
      status: 'active',
      safeRoute,
      color: center.color,
    };

    // Mark building as assigned
    const buildings = [...state.buildings];
    const bIdx = buildings.findIndex((b) => b.id === buildingId);
    if (bIdx !== -1) {
      buildings[bIdx] = { ...buildings[bIdx], assigned: true, assignedTeam: center.name, eta: mission.routeDuration };
    }

    const missions = [...state.missions, mission];
    set({
      missions,
      buildings,
      selectedCenter: null,
      selectedBuilding: null,
      routingMode: false,
      dispatchLoading: false,
      metrics: computeMetrics(buildings, [], state.simulation.elapsedMinutes, missions.filter(m => m.status === 'active').length),
    });
  },

  clearMissions: () => {
    const state = get();
    const buildings = state.buildings.map((b) => ({ ...b, assigned: false, assignedTeam: null, eta: null }));
    set({ missions: [], buildings, metrics: computeMetrics(buildings, [], state.simulation.elapsedMinutes, 0) });
  },

  tick: () => {
    const state = get();
    if (!state.simulation.running) return;
    const elapsed = state.simulation.elapsedMinutes + 1;
    const activeMissions = state.missions.filter((m) => m.status === 'active').length;
    set({
      metrics: computeMetrics(state.buildings, [], elapsed, activeMissions),
      simulation: { ...state.simulation, elapsedMinutes: elapsed },
    });
  },
}));

function computeMetrics(buildings: ScannedBuilding[], teams: RescueTeam[], elapsed: number, activeMissions: number): Metrics {
  const scanned = buildings.filter((b) => b.scanned);
  const assigned = buildings.filter((b) => b.assigned);
  return {
    totalBuildings: buildings.length,
    scannedCount: scanned.length,
    yikikCount: scanned.filter((b) => b.damageCategory === 'YIKIK').length,
    agirCount: scanned.filter((b) => b.damageCategory === 'AGIR').length,
    ortaCount: scanned.filter((b) => b.damageCategory === 'ORTA').length,
    hafifCount: scanned.filter((b) => b.damageCategory === 'HAFIF').length,
    saglamCount: scanned.filter((b) => b.damageCategory === 'SAGLAM').length,
    rescuedCount: assigned.length,
    activeTeams: activeMissions,
    avgEta: 0,
    estimatedLivesSaved: assigned.reduce((s, b) => s + b.residents, 0),
    responseImprovement: Math.min(35, elapsed > 0 ? Math.round(((720 - elapsed) / 720) * 100) : 0),
    elapsedMinutes: elapsed,
    activeMissions,
  };
}

function computePriorityZones(buildings: ScannedBuilding[]): PriorityZone[] {
  const cellSize = 0.005; // Smaller cells for dense Besiktas district
  const cells = new Map<string, ScannedBuilding[]>();
  for (const b of buildings) {
    if (!b.scanned) continue;
    const key = `${Math.floor(b.lat / cellSize)}_${Math.floor(b.lng / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(b);
  }
  const zones: PriorityZone[] = [];
  let zoneId = 0;
  cells.forEach((cellBuildings) => {
    const yikikCount = cellBuildings.filter((b) => b.damageCategory === 'YIKIK' || b.damageCategory === 'AGIR').length;
    if (yikikCount < 2) return; // Lower threshold for smaller cells
    const avgLat = cellBuildings.reduce((s, b) => s + b.lat, 0) / cellBuildings.length;
    const avgLng = cellBuildings.reduce((s, b) => s + b.lng, 0) / cellBuildings.length;
    const avgPriority = Math.round(
      cellBuildings.reduce((s, b) => s + (b.preSearchPriorityScore ?? b.priorityScore), 0) / cellBuildings.length
    );
    const ratio = yikikCount / cellBuildings.length;
    zones.push({
      id: `zone-${zoneId++}`, center: [avgLat, avgLng], radius: 0.25, // Tighter radius for district view
      level: ratio > 0.4 ? 'critical' : ratio > 0.2 ? 'high' : 'medium',
      buildingCount: cellBuildings.length, yikikCount, avgPriority: Math.round(avgPriority),
    });
  });
  return zones.sort((a, b) => b.avgPriority - a.avgPriority);
}

function getSafeRouteWaypoints(
  graph: RoadGraph,
  startLat: number,
  startLng: number,
  goalLat: number,
  goalLng: number
): [number, number][] {
  const startId = findNearestNodeId(graph, startLat, startLng);
  const goalId = findNearestNodeId(graph, goalLat, goalLng);
  if (!startId || !goalId) return [];

  const path = aStarPath(graph, startId, goalId);
  if (path.length === 0) return [];

  const pathCoords = pathToCoordinates(graph, path);
  const inner = pathCoords.slice(1, -1);
  if (inner.length === 0) return [];

  return sampleWaypoints(inner, 3);
}

function sampleWaypoints(
  coords: [number, number][],
  maxWaypoints: number
): [number, number][] {
  if (coords.length <= maxWaypoints) return coords;
  const waypoints: [number, number][] = [];
  const step = coords.length / (maxWaypoints + 1);
  for (let i = 1; i <= maxWaypoints; i++) {
    const idx = Math.min(coords.length - 1, Math.max(0, Math.round(i * step) - 1));
    waypoints.push(coords[idx]);
  }
  return waypoints;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
