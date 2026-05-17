// ============================================================================
// DEPREM-AI — Faz 2: Mock Computer Vision (Katman 1 Proxy)
// Simulates satellite & drone damage detection
// ============================================================================

import { RawBuilding } from './types';

/**
 * Stage 1 — Satellite scan (fast, coarse):
 * Returns a binary probability: YIKIK (collapsed) or AYAKTA (standing).
 * Uses building features to generate a realistic probability.
 */
export function satelliteScan(building: RawBuilding): {
  collapseProbability: number;
  label: 'YIKIK' | 'AYAKTA';
} {
  // Base collapse probability from physical attributes
  const ageFactor = Math.min(building.buildingAge / 80, 1.0) * 0.3;
  const soilFactor = ((building.soilAmplification - 1.0) / 1.5) * 0.25;
  const liqFactor = (building.liquefactionRisk / 0.8) * 0.15;
  const qualFactor = (1 - building.qualityScore / 10) * 0.2;
  const faultFactor = Math.max(0, 1 - building.distanceToFaultKm / 150) * 0.1;

  let probability = ageFactor + soilFactor + liqFactor + qualFactor + faultFactor;

  // Structure type modifier
  const structMod: Record<string, number> = {
    yigma: 0.25,
    betonarme_eski: 0.12,
    betonarme_orta: 0.03,
    betonarme_yeni: -0.05,
    betonarme_cok_yeni: -0.10,
    celik: -0.12,
  };
  probability += structMod[building.structureType] ?? 0;

  // Add controlled randomness (simulating CV model noise)
  probability += (seededRandom(building.id) - 0.5) * 0.15;

  probability = Math.max(0, Math.min(1, probability));

  return {
    collapseProbability: probability,
    label: probability > 0.45 ? 'YIKIK' : 'AYAKTA',
  };
}

/**
 * Stage 2 — Drone (İHA) detailed scan:
 * Returns a 0–4 continuous damage score (SegFormer/YOLOv8 proxy).
 *   0 = Sağlam, 1 = Hafif, 2 = Orta, 3 = Ağır, 4 = Yıkılmış
 */
export function droneScan(
  building: RawBuilding,
  satelliteCollapseProbability: number
): number {
  // Start from satellite probability, refine with building features
  let score = satelliteCollapseProbability * 3.2;

  // Floor penalty (taller = more damage potential)
  if (building.floors > 8) score += 0.3;
  else if (building.floors > 5) score += 0.15;

  // High occupancy density = higher scan priority (more lives at stake)
  const density = building.residents / (building.buildingArea / 100);
  if (density > 2) score += 0.1;

  // Controlled randomness for realism
  score += (seededRandom(building.id + '_drone') - 0.5) * 0.4;

  return Math.max(0, Math.min(4, Math.round(score * 10) / 10));
}

/**
 * Full 2-stage CV pipeline for a single building
 */
export function runCVPipeline(building: RawBuilding): {
  damageScore: number;
  collapseProbability: number;
} {
  const sat = satelliteScan(building);
  const damageScore = droneScan(building, sat.collapseProbability);
  return { damageScore, collapseProbability: sat.collapseProbability };
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random from string seed (for reproducible simulations)
// ---------------------------------------------------------------------------
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Normalize to 0-1
  return ((Math.abs(hash) % 10000) / 10000);
}
