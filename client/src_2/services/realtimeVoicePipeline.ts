/**
 * RealtimeVoicePipeline - Service 1: OpenAI Realtime API WebSocket client.
 */
import type { ClientWSEvent, ServerWSEvent, WSSessionConfig } from '@shared/types/websocket';
import { AudioEngine } from './audioEngine';
import { useStore } from '@/store';

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
  private userWantsStreaming = false;
  private audioReceivedInCurrentResponse = false;
  private config: WSSessionConfig | null = null;

  constructor(callbacks: RealtimePipelineCallbacks) {
    this.audioEngine = AudioEngine.getInstance();
    this.callbacks = callbacks;
  }

  async connect(config: WSSessionConfig): Promise<void> {
    this.config = config;
    this.reconnectAttempts = 0;
    await this.doConnect();
  }

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

  stopAudioStreaming(): void {
    this.userWantsStreaming = false;
    this.isStreaming = false;
    this.audioEngine.setOnAudioData(null);
  }

  resumeAudioStreaming(): void {
    if (this.userWantsStreaming) {
      this.isStreaming = true;
    }
  }

  commitAudio(): void {
    this.send({ type: 'audio.commit' });
  }

  cancelResponse(): void {
    this.audioEngine.stopPlayback();
  }

  clearConversation(): void {
    this.send({ type: 'conversation.clear' });
  }

  sendFunctionResult(callId: string, result: string): void {
    this.send({ type: 'function_call.result', callId, result });
  }

  sendCorrectionRejection(step?: string): void {
    this.send({ type: 'correction.rejected', step });
  }

  sendOptionsConfirmed(result: string): void {
    this.send({ type: 'options.confirmed', result });
  }

  sendMicUnblock(): void {
    this.send({ type: 'mic.unblock' } as any);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

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
          if (this.config) this.send({ type: 'session.start', config: this.config });
          resolve();
        };
        this.ws.onmessage = (event) => { this.handleMessage(event); };
        this.ws.onclose = (event) => {
          this.callbacks.onStateChange('disconnected');
          this.stopAudioStreaming();
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        this.ws.onerror = () => { reject(new Error('WebSocket connection failed')); };
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
      case 'session.created': break;
      case 'session.error': this.callbacks.onError(msg.error, msg.code); break;
      case 'input_audio_buffer.speech_started': this.callbacks.onSpeechStarted(); break;
      case 'input_audio_buffer.speech_stopped': this.callbacks.onSpeechStopped(); break;

      case 'response.audio.delta':
        this.audioReceivedInCurrentResponse = true;
        this.callbacks.onAudioDelta(msg.delta);
        this.audioEngine.enqueuePlayback(AudioEngine.base64ToArrayBuffer(msg.delta));
        break;

      case 'response.audio.done': this.callbacks.onAudioDone(); break;
      case 'response.audio_transcript.delta': this.callbacks.onTranscriptDelta(msg.delta); break;
      case 'response.audio_transcript.done': this.callbacks.onTranscriptDone(msg.transcript); break;
      case 'conversation.item.input_audio_transcription.completed': this.callbacks.onInputTranscript(msg.transcript); break;
      case 'transcription.filtered': this.callbacks.onTranscriptionFiltered(); break;

      case 'response.created':
        this.audioEngine.stopPlayback();
        this.audioEngine.resetPlayback();
        this.audioReceivedInCurrentResponse = false;
        if (this.userWantsStreaming) this.isStreaming = false;
        break;

      case 'response.function_call':
        this.callbacks.onFunctionCall(msg.callId, msg.name, msg.arguments);
        break;

      case 'response.done':
        this.audioEngine.resetPlayback();
        if (!this.audioReceivedInCurrentResponse && this.userWantsStreaming) {
          this.isStreaming = true;
        }
        this.callbacks.onResponseDone();
        break;

      case 'error': this.callbacks.onError(msg.error, msg.code); break;

      case 'pino.apply_check_result': {
        const pinoMsg = msg as Extract<typeof msg, { type: 'pino.apply_check_result' }>;
        useStore.getState().patchServiceData({
          pinoAccessToken: pinoMsg.accessToken,
          pinoCarrier: pinoMsg.carrier,
          pinoPhone: pinoMsg.phone,
          pinoGovDocId: pinoMsg.govDocId,
          pinoApplyOptionList: pinoMsg.applyOptionList ?? [],
          customOptionSelections: {},
        });
        break;
      }
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
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}