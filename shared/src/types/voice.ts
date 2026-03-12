/** Voice state machine states */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

/** Valid state transitions */
export const VOICE_TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  idle: ['listening', 'speaking', 'error'],       // speaking = AI-initiated (greeting)
  listening: ['processing', 'speaking', 'idle', 'error'], // speaking = AI responds / greeting
  processing: ['speaking', 'idle', 'error'],
  speaking: ['idle', 'listening', 'error'],        // listening = barge-in
  error: ['idle'],
};

/** Audio configuration for OpenAI Realtime API */
export const AUDIO_CONFIG = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  format: 'pcm16' as const,
  chunkDurationMs: 100,
  // Client-side VAD / Barge-in thresholds
  vads: {
    silentThreshold: 0.015,       // RMS threshold when AI is silent
    playbackThreshold: 0.008,     // RMS threshold when AI is speaking (after browser AEC)
    requiredFrames: 3,            // ~16ms of consecutive speech to trigger in silence
    windowSize: 10,               // ~53ms sliding window during playback
    windowRequired: 5,            // Number of frames in window to trigger barge-in
    aecLeakageFactor: 0.15,       // Estimated percentage of speaker audio leaking into mic
  }
} as const;

/** Voice pipeline mode */
export type PipelineMode = 'realtime' | 'cascaded';

/** Audio level data for visualization */
export interface AudioLevelData {
  rms: number;       // 0-1 normalized RMS level
  peak: number;      // 0-1 normalized peak level
  timestamp: number;
}

/** Turn detection configuration */
export interface TurnDetectionConfig {
  type: 'server_vad';
  threshold: number;        // 0-1, default 0.5
  prefix_padding_ms: number; // default 300
  silence_duration_ms: number; // default 500
}

/** Voice session configuration */
export interface VoiceSessionConfig {
  language: SupportedLanguage;
  pipelineMode: PipelineMode;
  turnDetection: TurnDetectionConfig;
  systemPrompt: string;
}

/** Supported languages */
export type SupportedLanguage = 'ko' | 'en';
