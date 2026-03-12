/**
 * Client-side timing constants (milliseconds).
 */
export const TIMINGS = {
  /** Auto-accept a pending correction after this delay */
  CORRECTION_AUTO_ACCEPT_MS: 8_000,
  /** Fallback delay to apply a pending correction if transcript never arrives */
  CORRECTION_FALLBACK_MS: 3_000,
  /** Transition from speaking → listening after response.done */
  RESPONSE_DONE_TRANSITION_MS: 500,
  /** Auto-recover from error state */
  ERROR_AUTO_RECOVER_MS: 3_000,
} as const;
