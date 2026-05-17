// ============================================================================
// DEPREM-AI — Faz 1: Data Parser & Priority Score Calculator
// Adapted from dask-plus-parametric pricing.py risk logic
// ============================================================================

import { RawBuilding, ScannedBuilding, DamageCategory } from './types';

/**
 * Target district for focused demo — Beşiktaş (dense, central Istanbul district).
 */
const TARGET_DISTRICT = 'Beşiktaş';
const API_URL = '/api/buildings';
const FALLBACK_URL = '/data/buildings.json';

/**
 * Fetch buildings from API (preferred) or public JSON fallback.
 * Filters to TARGET_DISTRICT only for a concentrated, realistic demo.
 */
export async function fetchBuildings(): Promise<RawBuilding[]> {
  const raw = await fetchBuildingsRaw();
  const all = raw.map(normalizeBuilding).filter((b): b is RawBuilding => b !== null);

  const filtered = all.filter((b) => b.district === TARGET_DISTRICT);
  return filtered.length > 0 ? filtered : all;
}

async function fetchBuildingsRaw(): Promise<unknown[]> {
  const urls = [API_URL, FALLBACK_URL];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch {
      // Try next fallback
    }
  }
  throw new Error('Failed to fetch buildings data');
}

function normalizeBuilding(raw: any): RawBuilding | null {
  if (!raw) return null;

  const constructionYear = toNumber(raw.constructionYear ?? raw.construction_year);
  const buildingAge = toNumber(raw.buildingAge ?? raw.building_age ?? (constructionYear ? 2026 - constructionYear : 0));

  const building: RawBuilding = {
    id: String(raw.id ?? raw.building_id ?? raw.buildingId ?? raw.buildingID ?? raw.building_no ?? raw.buildingNo ?? ''),
    lat: toNumber(raw.lat ?? raw.latitude),
    lng: toNumber(raw.lng ?? raw.longitude),
    district: String(raw.district ?? ''),
    neighborhood: String(raw.neighborhood ?? ''),
    structureType: String(raw.structureType ?? raw.structure_type ?? ''),
    constructionYear,
    buildingAge,
    floors: toNumber(raw.floors ?? raw.floor_count),
    residents: toNumber(raw.residents ?? raw.population ?? raw.occupants),
    soilType: String(raw.soilType ?? raw.soil_type ?? ''),
    soilAmplification: toNumber(raw.soilAmplification ?? raw.soil_amplification),
    liquefactionRisk: toNumber(raw.liquefactionRisk ?? raw.liquefaction_risk),
    distanceToFaultKm: toNumber(raw.distanceToFaultKm ?? raw.distance_to_fault_km),
    qualityScore: toNumber(raw.qualityScore ?? raw.quality_score),
    riskScore: toNumber(raw.riskScore ?? raw.risk_score),
    buildingArea: toNumber(raw.buildingArea ?? raw.building_area ?? raw.building_area_m2),
    preSearchPriorityScore: toOptionalNumber(raw.preSearchPriorityScore ?? raw.pre_search_priority_score),
    postDamageScore: toOptionalNumber(raw.postDamageScore ?? raw.post_damage_score),
    postDamageCategory: normalizeDamageCategory(raw.postDamageCategory ?? raw.post_damage_category),
  };

  if (!Number.isFinite(building.lat) || !Number.isFinite(building.lng)) return null;
  return building;
}

function normalizeDamageCategory(value: unknown): DamageCategory | undefined {
  const v = String(value ?? '').toUpperCase();
  if (v === 'YIKIK' || v === 'AGIR' || v === 'ORTA' || v === 'HAFIF' || v === 'SAGLAM') {
    return v as DamageCategory;
  }
  return undefined;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Priority Scores — pre-quake search vs post-quake rescue
// ---------------------------------------------------------------------------

/**
 * Calculate composite priority score for a building (0–100).
 *
 * Weights (inspired by pricing.py FineGrainedPricingEngine factor weights):
 *  - Fault distance risk:  25%
 *  - Building age factor:  15%
 *  - Structure quality:    20%
 *  - Soil amplification:   10%
 *  - Liquefaction risk:    12%
 *  - Damage score (CV):    18%  ← added for post-earthquake context
 */
export function calculatePriorityScore(
  building: RawBuilding,
  damageScore: number
): number {
  return calculateRescuePriorityScore(building, damageScore);
}

export function calculatePreSearchPriorityScore(building: RawBuilding): number {
  const risk = Math.min(Math.max(building.riskScore ?? 0, 0), 1);
  const residentsNorm = Math.min(building.residents / 120, 1);
  const raw = risk * 0.65 + residentsNorm * 0.35;
  return Math.round(Math.min(raw, 1) * 100);
}

export function calculateRescuePriorityScore(
  building: RawBuilding,
  damageScore: number
): number {
  const damageFactor = Math.min(Math.max(damageScore / 4, 0), 1);
  const residentsNorm = Math.min(building.residents / 120, 1);
  const floorsNorm = Math.min(building.floors / 20, 1);
  const raw = damageFactor * 0.6 + residentsNorm * 0.3 + floorsNorm * 0.1;
  return Math.round(Math.min(raw, 1) * 100);
}

/**
 * Determine damage category from a 0–4 score
 */
export function damageScoreToCategory(score: number): DamageCategory {
  if (score >= 3.5) return 'YIKIK';
  if (score >= 2.5) return 'AGIR';
  if (score >= 1.5) return 'ORTA';
  if (score >= 0.5) return 'HAFIF';
  return 'SAGLAM';
}

/**
 * Initialize a ScannedBuilding (unscanned state)
 */
export function initScannedBuilding(b: RawBuilding): ScannedBuilding {
  return {
    ...b,
    damageScore: 0,
    damageCategory: 'SAGLAM',
    priorityScore: 0,
    scanned: false,
    assigned: false,
    assignedTeam: null,
    eta: null,
  };
}

/**
 * Process buildings in async batches to avoid blocking the main thread.
 * Yields control back to the browser every `batchSize` items.
 */
export async function processBuildingsBatched(
  rawBuildings: RawBuilding[],
  processor: (b: RawBuilding) => ScannedBuilding,
  batchSize = 500,
  onProgress?: (processed: number, total: number) => void
): Promise<ScannedBuilding[]> {
  const result: ScannedBuilding[] = new Array(rawBuildings.length);

  for (let i = 0; i < rawBuildings.length; i += batchSize) {
    const end = Math.min(i + batchSize, rawBuildings.length);
    for (let j = i; j < end; j++) {
      result[j] = processor(rawBuildings[j]);
    }
    onProgress?.(end, rawBuildings.length);
    // Yield to browser every batch
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return result;
}
