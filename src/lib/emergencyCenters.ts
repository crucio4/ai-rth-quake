// ============================================================================
// DEPREM-AI — Istanbul Emergency Centers (Besiktas District Focus)
// Real + realistic locations concentrated around the Besiktas demo area
// ============================================================================

import { EmergencyCenter } from './types';

/**
 * Emergency centers positioned in/around Besiktas district for the focused demo.
 * Locations are realistic — based on real institutions in the area.
 */
export const ISTANBUL_EMERGENCY_CENTERS: EmergencyCenter[] = [
  // AFAD — Besiktas area coordination
  {
    id: 'afad-1',
    name: 'AFAD Beşiktaş Koordinasyon Merkezi',
    type: 'afad',
    lat: 41.0432,
    lng: 29.0062,
    icon: '🏛',
    color: '#ef4444',
    capacity: 8,
  },
  {
    id: 'afad-2',
    name: 'AFAD Beşiktaş Lojistik Üssü',
    type: 'afad',
    lat: 41.0406,
    lng: 29.0014,
    icon: '🏛',
    color: '#ef4444',
    capacity: 5,
  },
  // İtfaiye — spread across Besiktas
  {
    id: 'itf-1',
    name: 'İstanbul İtfaiye - Beşiktaş Merkez',
    type: 'itfaiye',
    lat: 41.0447,
    lng: 29.0041,
    icon: '🚒',
    color: '#f97316',
    capacity: 6,
  },
  {
    id: 'itf-2',
    name: 'İstanbul İtfaiye - Ortaköy',
    type: 'itfaiye',
    lat: 41.0487,
    lng: 29.0285,
    icon: '🚒',
    color: '#f97316',
    capacity: 4,
  },
  {
    id: 'itf-3',
    name: 'İstanbul İtfaiye - Levent',
    type: 'itfaiye',
    lat: 41.0750,
    lng: 29.0105,
    icon: '🚒',
    color: '#f97316',
    capacity: 4,
  },
  // Sağlık — major hospitals near Besiktas
  {
    id: 'sag-1',
    name: '112 Acil - Beşiktaş Sait Çiftçi Devlet',
    type: 'saglik',
    lat: 41.0457,
    lng: 29.0006,
    icon: '🏥',
    color: '#22c55e',
    capacity: 10,
  },
  {
    id: 'sag-2',
    name: 'Ulus Özel Hastanesi',
    type: 'saglik',
    lat: 41.0624,
    lng: 29.0082,
    icon: '🏥',
    color: '#22c55e',
    capacity: 8,
  },
  {
    id: 'sag-3',
    name: 'Zincirlikuyu Acil Destek',
    type: 'saglik',
    lat: 41.0662,
    lng: 29.0145,
    icon: '🏥',
    color: '#22c55e',
    capacity: 12,
  },
  // Emniyet — security coordination
  {
    id: 'jan-1',
    name: 'Beşiktaş İlçe Emniyet Müdürlüğü',
    type: 'jandarma',
    lat: 41.0428,
    lng: 29.0048,
    icon: '🛡',
    color: '#3b82f6',
    capacity: 6,
  },
];

/** Get center by ID */
export function getCenterById(id: string): EmergencyCenter | undefined {
  return ISTANBUL_EMERGENCY_CENTERS.find((c) => c.id === id);
}
