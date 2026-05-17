// ============================================================================
// DEPREM-AI — Faz 8: Demo Fallback Engine
// ============================================================================

/**
 * Check if demo mode is enabled (via URL param or env)
 */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('demo') === 'true';
}
