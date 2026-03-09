
/**
 * RealtimeVoicePipeline - Service 1: OpenAI Realtime API WebSocket client.
 * Handles bidirectional audio streaming with server VAD.
 *
 * Turn-taking model (no barge-in):
 *  - AI 응답 시작(response.created) → isStreaming=false (마이크 차단)
 *  - AI 오디오 재생 완료(resumeAudioStreaming 호출) → isStreaming=true (마이크 재개)
 *    → useRealtimeAPI의 onPlaybackEnd 콜백에서 호출됨
 *  - 오디오 없는 응답(function call only)은 response.done에서 즉시 재개
 */

import type { ClientWSEvent, ServerWSEvent, WSSessionConfig } from '@shared/types/websocket';
import { AudioEngine } from './audioEngine';

export interface RealtimePipelineCallbacks {
  onStateChange: (state: 'connecting' | 'connected' | 'disconnected') => void;
  onSpeechStarted: () => void;
  onSpeechStopped: () => void;
  onAudioDelta: (base64Audio: string) => void;
  onAudioDone: () => void;
  onTranscriptDelta: (delta: string) => void;
  onTranscriptDone: (transcript: string) => void;
  onInputTranscript: (transcript: string) => void;
  onTranscriptionFiltered: () => void;
  onFunctionCall: (callId: string, name: string, args: string) => void;
  onResponseDone: () => void;
  onError: (error: string, code: string) => void;
}

export class RealtimeVoicePipeline {
  private ws: WebSocket | null = null;
  private audioEngine: AudioEngine;
  private callbacks: RealtimePipelineCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isStreaming = false;
  // userWantsStreaming: 사용자가 마이크를 켜둔 상태인지 추적.
  private userWantsStreaming = false;
  // audioReceivedInCurrentResponse: 현재 응답에서 오디오 델타를 수신했는지 추적.
  // true면 재생 완료(onPlaybackEnd) 후 마이크 재개.
  // false(function-call-only 응답)면 response.done에서 즉시 재개.
  private audioReceivedInCurrentResponse = false;
  private config: WSSessionConfig | null = null;

  constructor(callbacks: RealtimePipelineCallbacks) {
    this.audioEngine = AudioEngine.getInstance();
    this.callbacks = callbacks;
  }

  /** Connect to backend WebSocket proxy */
  async connect(config: WSSessionConfig): Promise<void> {
    this.config = config;
    this.reconnectAttempts = 0;
    await this.doConnect();
  }

  /** Disconnect and cleanup */
  disconnect(): void {
    this.clearReconnectTimer();
    this.stopAudioStreaming();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this.callbacks.onStateChange('disconnected');
  }

  /** Start streaming microphone audio to server */
  startAudioStreaming(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.userWantsStreaming = true;
    this.isStreaming = true;

    this.audioEngine.setOnAudioData((pcm16) => {
      if (!this.isStreaming || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const base64 = AudioEngine.arrayBufferToBase64(pcm16);
      this.send({ type: 'audio.append', audio: base64 });
    });
  }

  /** Stop streaming microphone audio */
  stopAudioStreaming(): void {
    this.userWantsStreaming = false;
    this.isStreaming = false;
    this.audioEngine.setOnAudioData(null);
  }

  /**
   * AI 오디오 재생이 완전히 끝난 후 마이크 입력을 재개.
   * useRealtimeAPI의 onPlaybackEnd 콜백에서 호출됨.
   */
  resumeAudioStreaming(): void {
    if (this.userWantsStreaming) {
      this.isStreaming = true;
    }
  }

  /** Commit audio buffer (manual send) */
  commitAudio(): void {
    this.send({ type: 'audio.commit' });
  }

  /** Stop current playback (for session end) */
  cancelResponse(): void {
    this.audioEngine.stopPlayback();
  }

  /** Clear conversation history */
  clearConversation(): void {
    this.send({ type: 'conversation.clear' });
  }

  /** Send function call result back to server */
  sendFunctionResult(callId: string, result: string): void {
    this.send({ type: 'function_call.result', callId, result });
  }

  /** Send correction rejection to server */
  sendCorrectionRejection(step?: string): void {
    this.send({ type: 'correction.rejected', step });
  }

  /** Send options confirmed event to server */
  sendOptionsConfirmed(result: string): void {
    this.send({ type: 'options.confirmed', result });
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Private Methods ────────────────────────────────────

  private async doConnect(): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime`;

    this.callbacks.onStateChange('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.callbacks.onStateChange('connected');

          if (this.config) {
            this.send({ type: 'session.start', config: this.config });
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.callbacks.onStateChange('disconnected');
          this.stopAudioStreaming();

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = () => {
          reject(new Error('WebSocket connection failed'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    let msg: ServerWSEvent;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
    } catch {
      console.error('[RealtimePipeline] Failed to parse message');
      return;
    }

    switch (msg.type) {
      case 'session.created':
        break;

      case 'session.error':
        this.callbacks.onError(msg.error, msg.code);
        break;

      case 'input_audio_buffer.speech_started':
        // 바지인 없음: 단순히 상태 콜백만 전달
        this.callbacks.onSpeechStarted();
        break;

      case 'input_audio_buffer.speech_stopped':
        this.callbacks.onSpeechStopped();
        break;

      case 'response.audio.delta':
        // 이번 응답에 오디오가 있음을 표시 → 마이크 재개는 onPlaybackEnd까지 대기
        this.audioReceivedInCurrentResponse = true;
        this.callbacks.onAudioDelta(msg.delta);
        this.audioEngine.enqueuePlayback(
          AudioEngine.base64ToArrayBuffer(msg.delta)
        );
        break;

      case 'response.audio.done':
        this.callbacks.onAudioDone();
        break;

      case 'response.audio_transcript.delta':
        this.callbacks.onTranscriptDelta(msg.delta);
        break;

      case 'response.audio_transcript.done':
        this.callbacks.onTranscriptDone(msg.transcript);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.callbacks.onInputTranscript(msg.transcript);
        break;

      case 'transcription.filtered':
        this.callbacks.onTranscriptionFiltered();
        break;

      case 'response.created':
        // AI 응답 시작 — 재생 초기화 및 마이크 차단 (turn-taking)
        this.audioEngine.stopPlayback();
        this.audioEngine.resetPlayback();
        this.audioReceivedInCurrentResponse = false;
        if (this.userWantsStreaming) {
          this.isStreaming = false;
        }
        break;

      case 'response.function_call':
        this.callbacks.onFunctionCall(msg.callId, msg.name, msg.arguments);
        break;

      case 'response.done':
        // 응답 완료.
        // 오디오가 없는 응답(function call only)은 onPlaybackEnd가 호출되지 않으므로
        // 여기서 즉시 마이크를 재개.
        // 오디오가 있었던 경우에는 onPlaybackEnd에서 resumeAudioStreaming()이 호출됨.
        this.audioEngine.resetPlayback();
        if (!this.audioReceivedInCurrentResponse && this.userWantsStreaming) {
          this.isStreaming = true;
        }
        this.callbacks.onResponseDone();
        break;

      case 'error':
        this.callbacks.onError(msg.error, msg.code);
        break;
    }
  }

  private send(event: ClientWSEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[RealtimePipeline] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.doConnect();
      } catch {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.callbacks.onError('Max reconnection attempts reached', 'RECONNECT_FAILED');
        }
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}