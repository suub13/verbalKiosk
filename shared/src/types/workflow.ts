/**
 * WorkflowStep — string-based so each service definition can declare its own steps.
 * Core infrastructure uses this type; actual step keys are owned by service definitions.
 */
export type WorkflowStep = string;

/** Well-known steps shared across all services */
export const SHARED_STEPS = {
  VERIFY: 'verify',
  SEARCH: 'search',
  FILL: 'fill',
  REVIEW: 'review',
  ISSUE: 'issue',
} as const;
