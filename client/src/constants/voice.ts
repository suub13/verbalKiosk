/**
 * Voice pipeline constants shared across hooks and services.
 */
 
/**
 * Workflow steps where the microphone is automatically disabled.
 * When entering these steps, audio capture and streaming are stopped.
 * When leaving, they are restored automatically.
 */
export const MIC_INACTIVE_STEPS = ['verify', 'sign', 'issue'] as const;
 
export type MicInactiveStep = (typeof MIC_INACTIVE_STEPS)[number];
 