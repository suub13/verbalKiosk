import type { SupportedLanguage } from './voice';

/** Client → Server WebSocket events */
export type ClientWSEvent =
  | { type: 'session.start'; config: WSSessionConfig }
  | { type: 'audio.append'; audio: string } // base64 PCM16
  | { type: 'audio.commit' }
  | { type: 'audio.clear' }
  | { type: 'response.cancel' }
  | { type: 'conversation.clear' }
  | { type: 'function_call.result'; callId: string; result: string }
  | { type: 'correction.rejected'; step?: string }
  | { type: 'options.confirmed'; result: string };

/** Server → Client WebSocket events */
export type ServerWSEvent =
  | { type: 'session.created'; sessionId: string }
  | { type: 'session.error'; error: string; code: string }
  | { type: 'input_audio_buffer.speech_started' }
  | { type: 'input_audio_buffer.speech_stopped' }
  | { type: 'input_audio_buffer.committed' }
  | { type: 'response.audio.delta'; delta: string } // base64 PCM16
  | { type: 'response.audio.done' }
  | { type: 'response.audio_transcript.delta'; delta: string }
  | { type: 'response.audio_transcript.done'; transcript: string }
  | { type: 'response.function_call'; callId: string; name: string; arguments: string }
  | { type: 'response.created' }
  | { type: 'response.done' }
  | { type: 'conversation.item.input_audio_transcription.completed'; transcript: string }
  | { type: 'transcription.filtered' }
  | { type: 'error'; error: string; code: string }
  | {
      type: 'pino.apply_check_result';
      accessToken: string;
      carrier: string;
      phone: string;
      govDocId: string;
      applyOptionList: Array<{
        groupCode: string;
        groupCodeName: string;
        multiAbleAt: 'Y' | 'N';
        requiredAt: 'Y' | 'N';
        childList: Array<{ code: string; name: string; desc?: string }>;
      }>;
    };

/** WebSocket session configuration */
export interface WSSessionConfig {
  sessionId?: string;
  language: SupportedLanguage;
  systemPrompt?: string;
  tools?: WSToolDefinition[];
  turnDetection?: {
    type: 'server_vad';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
}

/** Tool definition for Realtime API */
export interface WSToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
