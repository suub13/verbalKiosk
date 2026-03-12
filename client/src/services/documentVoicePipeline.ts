/**
 * DocumentVoicePipeline - Service 2: Cascaded STT → LLM → TTS pipeline.
 * Used for document voice guide where precise field-by-field reading is needed.
 */

import { AudioEngine } from './audioEngine';
import { getErrorMessage } from '@shared/utils/errors';

interface CascadedCallbacks {
  onTranscription: (text: string) => void;
  onReply: (text: string) => void;
  onTTSStart: () => void;
  onTTSEnd: () => void;
  onBargeIn?: () => void;
  onError: (error: string) => void;
}

export class DocumentVoicePipeline {
  private audioEngine: AudioEngine;
  private callbacks: CascadedCallbacks;
  private sessionId: string | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingChunks: ArrayBuffer[] = [];
  private isRecording = false;
  private isSpeaking = false;

  // Client-side VAD settings
  private silenceThreshold = 0.02;
  private silenceDurationMs = 1500;

  // Barge-in detection settings (higher threshold to avoid echo false positives)
  private bargeInThreshold = 0.08;
  private bargeInMinFrames = 3; // ~50ms at 60fps - requires sustained speech

  constructor(callbacks: CascadedCallbacks) {
    this.audioEngine = AudioEngine.getInstance();
    this.callbacks = callbacks;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /** Start listening with client-side VAD */
  async startListening(): Promise<void> {
    this.recordingChunks = [];
    this.isRecording = true;

    this.audioEngine.setOnAudioData((pcm16) => {
      if (!this.isRecording) return;
      this.recordingChunks.push(pcm16);
    });

    // Client-side silence detection
    this.audioEngine.setOnAudioLevel((level) => {
      if (!this.isRecording) return;

      if (level.rms > this.silenceThreshold) {
        // Speech detected - reset silence timer
        this.clearSilenceTimer();
      } else if (this.recordingChunks.length > 0 && !this.silenceTimer) {
        // Silence detected after speech - start timer
        this.silenceTimer = setTimeout(() => {
          this.finishRecording();
        }, this.silenceDurationMs);
      }
    });

    await this.audioEngine.startMicCapture();
  }

  /** Stop listening */
  stopListening(): void {
    this.isRecording = false;
    this.clearSilenceTimer();
    this.audioEngine.setOnAudioData(null);
    this.audioEngine.setOnAudioLevel(null);
    this.audioEngine.stopMicCapture();
  }

  /** Speak text using TTS - with barge-in detection via mic monitoring */
  async speak(text: string, language = 'ko', speed = 1.0): Promise<void> {
    if (!this.sessionId) throw new Error('No session');

    this.callbacks.onTTSStart();
    this.isSpeaking = true;

    try {
      const response = await fetch('/api/tts/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          text,
          language,
          speed,
        }),
      });

      if (!response.ok) throw new Error('TTS request failed');

      const arrayBuffer = await response.arrayBuffer();

      // Start mic capture for barge-in detection during playback
      await this.audioEngine.startMicCapture();

      let bargedIn = false;
      let speechFrames = 0;

      // Set up promise that resolves on either playback end or barge-in
      await new Promise<void>(resolve => {
        const cleanup = () => {
          this.audioEngine.setOnPlaybackEnd(null);
          this.audioEngine.setOnAudioLevel(null);
        };

        // Monitor mic levels for user speech during TTS playback
        this.audioEngine.setOnAudioLevel((level) => {
          if (!this.isSpeaking) return;

          if (level.rms > this.bargeInThreshold) {
            speechFrames++;
            // Require consecutive frames above threshold to avoid echo false positives
            if (speechFrames >= this.bargeInMinFrames) {
              bargedIn = true;
              this.isSpeaking = false;
              this.audioEngine.stopPlayback();
              cleanup();
              resolve();
            }
          } else {
            speechFrames = 0;
          }
        });

        // Normal playback end
        this.audioEngine.setOnPlaybackEnd(() => {
          cleanup();
          resolve();
        });

        this.audioEngine.enqueuePlayback(arrayBuffer);
      });

      if (bargedIn) {
        // Keep mic running so caller can immediately start listening
        this.callbacks.onBargeIn?.();
      } else {
        this.audioEngine.stopMicCapture();
      }
    } catch (err) {
      this.audioEngine.setOnAudioLevel(null);
      this.audioEngine.stopMicCapture();
      this.callbacks.onError(getErrorMessage(err));
    } finally {
      this.isSpeaking = false;
      this.callbacks.onTTSEnd();
    }
  }

  /** Stop current speech */
  stopSpeaking(): void {
    this.isSpeaking = false;
    this.audioEngine.setOnAudioLevel(null);
    this.audioEngine.stopPlayback();
    this.callbacks.onTTSEnd();
  }

  /** Send text message for LLM response */
  async chat(message: string, documentId?: string): Promise<string> {
    if (!this.sessionId) throw new Error('No session');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        message,
        context: documentId ? { documentId } : undefined,
      }),
    });

    if (!response.ok) throw new Error('Chat request failed');

    const data = await response.json();
    if (data.success && data.data) {
      this.callbacks.onReply(data.data.reply);
      return data.data.reply;
    }

    throw new Error(data.error?.message || 'Chat failed');
  }

  // ─── Private ────────────────────────────────────────────

  private async finishRecording(): Promise<void> {
    this.isRecording = false;
    this.clearSilenceTimer();
    this.audioEngine.stopMicCapture();

    if (this.recordingChunks.length === 0) return;

    // Concatenate audio chunks
    const totalLength = this.recordingChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordingChunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    this.recordingChunks = [];

    // Send for transcription
    const base64 = AudioEngine.arrayBufferToBase64(combined.buffer);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          audio: base64,
          language: 'ko',
        }),
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      if (data.success && data.data?.text) {
        this.callbacks.onTranscription(data.data.text);
      }
    } catch (err) {
      this.callbacks.onError(getErrorMessage(err));
    }
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
