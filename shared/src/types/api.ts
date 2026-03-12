import type { SupportedLanguage } from './voice';
import type { DocumentStructure } from './document';

// ─── Session ─────────────────────────────────────────────
export interface CreateSessionRequest {
  language: SupportedLanguage;
  serviceType: 'conversation' | 'document';
}

export interface CreateSessionResponse {
  sessionId: string;
  expiresAt: number;
}

// ─── Transcribe (Service 2 - Cascaded) ──────────────────
export interface TranscribeRequest {
  sessionId: string;
  /** base64-encoded PCM16 audio */
  audio: string;
  language: SupportedLanguage;
}

export interface TranscribeResponse {
  text: string;
  language: SupportedLanguage;
  confidence: number;
}

// ─── TTS (Service 2 - Cascaded) ─────────────────────────
export interface TTSRequest {
  sessionId: string;
  text: string;
  voice?: string;
  speed?: number;
  language: SupportedLanguage;
}
// Response is audio/pcm stream

// ─── Chat (Service 2 - Cascaded) ────────────────────────
export interface ChatRequest {
  sessionId: string;
  message: string;
  context?: {
    documentId?: string;
    fieldId?: string;
  };
}

export interface ChatResponse {
  reply: string;
  functionCalls?: FunctionCallResult[];
}

export interface FunctionCallResult {
  name: string;
  result: unknown;
}

// ─── Document ───────────────────────────────────────────
export interface DocumentUploadResponse {
  documentId: string;
  fileName: string;
  pageCount: number;
  structure: DocumentStructure;
}

export interface DocumentTranslateRequest {
  targetLanguage: SupportedLanguage;
  fieldIds?: string[];
}

export interface DocumentTranslateResponse {
  translations: Record<string, string>;
}

// ─── Common ─────────────────────────────────────────────
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
