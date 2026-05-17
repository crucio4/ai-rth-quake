// ============================================================================
// DEPREM-AI — Core Type Definitions
// ============================================================================

export interface RawBuilding {
  id: string;
  lat: number;
  lng: number;
  district: string;
  neighborhood: string;
  structureType: string;
  constructionYear: number;
  buildingAge: number;
  floors: number;
  residents: number;
  soilType: string;
  soilAmplification: number;
  liquefactionRisk: number;
  distanceToFaultKm: number;
  qualityScore: number;
  riskScore: number;
  buildingArea: number;
  preSearchPriorityScore?: number;
  postDamageScore?: number;
  postDamageCategory?: DamageCategory;
}

export type DamageCategory = 'YIKIK' | 'AGIR' | 'ORTA' | 'HAFIF' | 'SAGLAM';

export interface ScannedBuilding extends RawBuilding {
  damageScore: number;
  damageCategory: DamageCategory;
  priorityScore: number;
  scanned: boolean;
  assigned: boolean;
  assignedTeam: string | null;
  eta: number | null;
}

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  edges: string[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  weight: number;
  blocked: boolean;
}

export interface RoadGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

/** Real Istanbul emergency center */
export interface EmergencyCenter {
  id: string;
  name: string;
  type: 'afad' | 'itfaiye' | 'saglik' | 'jandarma';
  lat: number;
  lng: number;
  icon: string;
  color: string;
  capacity: number; // teams available
}

/** A dispatched rescue mission */
export interface RescueMission {
  id: string;
  fromCenter: string;
  toBuildingId: string;
  route: [number, number][];
  routeDistance: number; // km
  routeDuration: number; // minutes
  status: 'planned' | 'active' | 'completed';
  safeRoute: boolean;
  color: string;
}

export interface RescueTeam {
  id: string;
  name: string;
  lat: number;
  lng: number;
  targetBuildingId: string | null;
  route: [number, number][];
  status: 'idle' | 'en_route' | 'rescuing' | 'returning';
  color: string;
  rescuedCount: number;
  eta: number;
}

export interface SimulationState {
  elapsedMinutes: number;
  running: boolean;
  speed: number;
  scenario: string;
}

export interface Metrics {
  totalBuildings: number;
  scannedCount: number;
  yikikCount: number;
  agirCount: number;
  ortaCount: number;
  hafifCount: number;
  saglamCount: number;
  rescuedCount: number;
  activeTeams: number;
  avgEta: number;
  estimatedLivesSaved: number;
  responseImprovement: number;
  elapsedMinutes: number;
  activeMissions: number;
}
