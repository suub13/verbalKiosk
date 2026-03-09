/**
 * Safely extracts a message string from an unknown thrown value.
 * Handles Error objects, plain strings, and anything else.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
