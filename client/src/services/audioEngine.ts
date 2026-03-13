/**
 * AudioEngine - Singleton managing all Web Audio API operations.
 * Handles: microphone capture, noise suppression, PCM16 conversion,
 * TTS audio playback, and audio level metering.
 */

import { AUDIO_CONFIG } from '@shared/types/voice';
import type { AudioLevelData } from '@shared/types/voice';

type AudioLevelCallback = (level: AudioLevelData) => void;
type AudioDataCallback = (pcm16: ArrayBuffer) => void;

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;

  // Playback
  private playbackQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private playbackAborted = false;
  private currentPlaybackSource: AudioBufferSourceNode | null = null;
  private playbackGain: GainNode | null = null;

  // SharedArrayBuffer barge-in (lock-free audio thread → main thread)
  private sharedBargeInBuffer: SharedArrayBuffer | null = null;
  private sharedBargeInArray: Int32Array | null = null;
  private useSharedBargeIn = false;

  // Callbacks
  private onAudioLevel: AudioLevelCallback | null = null;
  private onAudioData: AudioDataCallback | null = null;
  private onPlaybackEnd: (() => void) | null = null;
  private onBargeInDetected: (() => void) | null = null;

  // Level metering
  private levelAnimationId: number | null = null;
  private analyserData: Float32Array<ArrayBuffer> | null = null;

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /** Initialize AudioContext (must be called from user gesture) */
  async initialize(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return;
    }

    this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
    this.playbackGain = this.audioContext.createGain();
    this.playbackGain.connect(this.audioContext.destination);

    // Register PCM16 capture worklet
    await this.audioContext.audioWorklet.addModule(
      this.createWorkletBlobURL()
    );

    // SharedArrayBuffer for lock-free barge-in signaling from audio thread
    if (typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated) {
      this.sharedBargeInBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
      this.sharedBargeInArray = new Int32Array(this.sharedBargeInBuffer);
      this.useSharedBargeIn = true;
      console.log('[AudioEngine] SharedArrayBuffer barge-in detection enabled');
    }
  }

  /** Start microphone capture and begin streaming PCM16 chunks */
  async startMicCapture(): Promise<void> {
    if (!this.audioContext) throw new Error('AudioEngine not initialized');

    // 이미 캡처 중이면 중복 실행 방지 (workletNode가 살아있으면 skip)
    if (this.workletNode) {
      this.micStream?.getAudioTracks().forEach(t => { t.enabled = true; });
      return;
    }

    // 스트림 재사용: 이미 열린 스트림이 있으면 getUserMedia 재호출 없이 바로 사용 (딜레이 방지)
    if (!this.micStream) {
      this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: AUDIO_CONFIG.sampleRate,
        channelCount: AUDIO_CONFIG.channels,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      });
    }

    // 트랙 활성화
    this.micStream.getAudioTracks().forEach(t => { t.enabled = true; });

    this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

    // Analyser for level metering
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserData = new Float32Array(this.analyserNode.fftSize);
    this.micSource.connect(this.analyserNode);

    // AudioWorklet for PCM16 capture (input 0: mic, input 1: speaker reference)
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-capture', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: {
        vads: AUDIO_CONFIG.vads,
        sampleRate: AUDIO_CONFIG.sampleRate,
        chunkSize: Math.floor(AUDIO_CONFIG.sampleRate * AUDIO_CONFIG.chunkDurationMs / 1000)
      }
    });

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'audio-data' && this.onAudioData) {
        this.onAudioData(event.data.buffer);
      } else if (event.data.type === 'barge-in') {
        this.onBargeInDetected?.();
      }
    };

    // Send SharedArrayBuffer to worklet for atomic barge-in signaling
    if (this.useSharedBargeIn && this.sharedBargeInBuffer) {
      this.workletNode.port.postMessage({ type: 'shared-buffer', buffer: this.sharedBargeInBuffer });
    }

    this.micSource.connect(this.workletNode, 0, 0); // mic → worklet input 0

    // Route speaker output as reference channel for echo reduction in barge-in detection
    if (this.playbackGain) {
      this.playbackGain.connect(this.workletNode, 0, 1); // speaker → worklet input 1
    }

    this.workletNode.connect(this.audioContext.destination); // needed for processing, gain=0

    this.startLevelMetering();
  }

  /** Stop microphone capture (스트림은 유지, track만 mute — 재시작 딜레이 방지) */
  stopMicCapture(): void {
    this.stopLevelMetering();

    // Disconnect speaker reference from worklet (keep playbackGain → destination intact)
    if (this.playbackGain && this.workletNode) {
      try { this.playbackGain.disconnect(this.workletNode); } catch { /* already disconnected */ }
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    // 스트림은 종료하지 않고 track만 mute → 재시작 시 getUserMedia 재호출 불필요
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => { track.enabled = false; });
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
  }

  /** 마이크 스트림 완전 종료 (세션 종료 시에만 호출) */
  releaseMicStream(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }

  /** Queue PCM16 audio data for playback (from TTS or Realtime API) */
  enqueuePlayback(pcm16Data: ArrayBuffer): void {
    if (this.playbackAborted) return;

    // SharedArrayBuffer barge-in: each WebSocket audio.delta acts as a poll point
    if (this.useSharedBargeIn && this.sharedBargeInArray) {
      if (Atomics.load(this.sharedBargeInArray, 0) === 1) {
        Atomics.store(this.sharedBargeInArray, 0, 0);
        this.stopPlayback();
        this.onBargeInDetected?.();
        return;
      }
    }

    this.playbackQueue.push(pcm16Data);
    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  /** Stop all playback immediately (for barge-in) */
  stopPlayback(): void {
    this.playbackAborted = true;
    this.playbackQueue = [];
    this.isPlaying = false;

    // Fast ramp-down to 0 to prevent clicking noise while responding instantly
    if (this.playbackGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.playbackGain.gain.cancelScheduledValues(now);
      this.playbackGain.gain.setValueAtTime(this.playbackGain.gain.value, now);
      this.playbackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015); // 15ms fade-out
    }

    if (this.currentPlaybackSource) {
      this.currentPlaybackSource.onended = null;
      try {
        // Stop after the fade-out duration
        const source = this.currentPlaybackSource;
        setTimeout(() => {
          try { source.stop(); source.disconnect(); } catch {}
        }, 20);
      } catch { /* already stopped */ }
      this.currentPlaybackSource = null;
    }

    // Restore gain for next playback (silent until reset)
    if (this.playbackGain && this.audioContext) {
      this.playbackGain.gain.setValueAtTime(0, this.audioContext.currentTime + 0.02);
    }
  }

  /** Reset abort flag and restore gain for new response */
  resetPlayback(): void {
    this.playbackAborted = false;
    if (this.useSharedBargeIn && this.sharedBargeInArray) {
      Atomics.store(this.sharedBargeInArray, 0, 0);
    }
    if (this.playbackGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.playbackGain.gain.cancelScheduledValues(now);
      this.playbackGain.gain.setValueAtTime(0, now);
      this.playbackGain.gain.linearRampToValueAtTime(1, now + 0.05); // 50ms fade-in
    }
  }

  /** Clear playback queue without stopping current */
  clearPlaybackQueue(): void {
    this.playbackQueue = [];
  }

  /** Set playback volume (0-1) */
  setVolume(volume: number): void {
    if (this.playbackGain) {
      this.playbackGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext?.currentTime ?? 0
      );
    }
  }

  /** Register callback for audio level data (60fps metering) */
  setOnAudioLevel(callback: AudioLevelCallback | null): void {
    this.onAudioLevel = callback;
  }

  /** Register callback for PCM16 audio data from microphone */
  setOnAudioData(callback: AudioDataCallback | null): void {
    this.onAudioData = callback;
  }

  /** Register callback for when playback queue is exhausted */
  setOnPlaybackEnd(callback: (() => void) | null): void {
    this.onPlaybackEnd = callback;
  }

  /**
   * Register callback for worklet-driven barge-in detection.
   * Unlike onAudioLevel (rAF, ~16ms, main-thread-dependent),
   * this runs on the audio thread (~5ms resolution) and is immune
   * to main-thread congestion from WebSocket message floods.
   */
  setOnBargeInDetected(callback: (() => void) | null): void {
    this.onBargeInDetected = callback;
  }

  /** Arm barge-in detection in the AudioWorklet (call when AI starts speaking) */
  armBargeIn(): void {
    if (this.useSharedBargeIn && this.sharedBargeInArray) {
      Atomics.store(this.sharedBargeInArray, 0, 0);
    }
    this.workletNode?.port.postMessage({ type: 'barge-in-arm' });
  }

  /** Disarm barge-in detection in the AudioWorklet */
  disarmBargeIn(): void {
    if (this.useSharedBargeIn && this.sharedBargeInArray) {
      Atomics.store(this.sharedBargeInArray, 0, 0);
    }
    this.workletNode?.port.postMessage({ type: 'barge-in-disarm' });
  }

  /** Check if microphone permission is available */
  async checkMicPermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state;
    } catch {
      return 'prompt';
    }
  }

  /** Get current AudioContext state */
  getState(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized';
  }

  /** Convert base64-encoded PCM16 to ArrayBuffer */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /** Convert ArrayBuffer to base64 string */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 기계음(삐--) 재생 메서드.
   * AI 음성 재생이 완전히 끝난 후 AudioEngine.onPlaybackEnd 콜백을 통해 호출됩니다.
   * 키오스크 장비에서 흔히 사용하는 단순한 단음 "삐--" 전자음을 합성합니다.
   *
   * [수정 전] 2음 상승형 전자음 (880Hz→C6, C6→E6 두 번 순차 재생)
   * [수정 후] 단순 단음 "삐--" (1000Hz 사인파, 0.35초 지속)
   *           - 어택(5ms): 클릭 잡음 방지를 위한 짧은 페이드인
   *           - 서스테인(0.3초): 일정 볼륨 유지
   *           - 릴리즈(50ms): 부드러운 페이드아웃
   */
  playMechanicalBeep(): void {
    // AudioContext가 초기화되지 않은 경우 조용히 종료
    if (!this.audioContext) return;
    // AudioContext가 suspended 상태(사용자 제스처 대기)면 재생 불가
    if (this.audioContext.state === 'suspended') return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // ── 단음 "삐--" 합성 ──
    // 사인파(sine): 부드럽고 명확한 전자음 / 스퀘어파보다 귀에 덜 날카로움
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now); // 1000Hz — 키오스크 표준 알림음 주파수

    // 게인 엔벨로프: 어택 → 서스테인 → 릴리즈
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005); // 어택 5ms (클릭 방지)
    gain.gain.setValueAtTime(0.18, now + 0.31);           // 서스테인 0.3초 유지
    gain.gain.linearRampToValueAtTime(0, now + 0.36);     // 릴리즈 50ms 페이드아웃

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36); // 총 재생 시간 0.36초
  }

  /** Cleanup all resources */
  async destroy(): Promise<void> {
    this.stopMicCapture();
    this.stopPlayback();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
    this.sharedBargeInBuffer = null;
    this.sharedBargeInArray = null;
    this.useSharedBargeIn = false;
    AudioEngine.instance = null;
  }

  // ─── Private Methods ────────────────────────────────────

  private async processPlaybackQueue(): Promise<void> {
    if (this.playbackAborted || !this.audioContext || this.playbackQueue.length === 0) {
      this.isPlaying = false;
      if (!this.playbackAborted) {
        this.onPlaybackEnd?.();
      }
      return;
    }

    // Check SAB barge-in between chunks (covers post-streaming queue drain)
    if (this.useSharedBargeIn && this.sharedBargeInArray) {
      if (Atomics.load(this.sharedBargeInArray, 0) === 1) {
        Atomics.store(this.sharedBargeInArray, 0, 0);
        this.stopPlayback();
        this.onBargeInDetected?.();
        return;
      }
    }

    this.isPlaying = true;
    const pcm16Data = this.playbackQueue.shift()!;

    const audioBuffer = this.pcm16ToAudioBuffer(pcm16Data);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackGain!);

    this.currentPlaybackSource = source;

    source.onended = () => {
      this.currentPlaybackSource = null;
      this.processPlaybackQueue();
    };

    source.start();
  }

  private pcm16ToAudioBuffer(pcm16Data: ArrayBuffer): AudioBuffer {
    const int16 = new Int16Array(pcm16Data);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.audioContext!.createBuffer(
      1,
      float32.length,
      AUDIO_CONFIG.sampleRate
    );
    audioBuffer.copyToChannel(float32, 0);
    return audioBuffer;
  }

  private startLevelMetering(): void {
    const meter = () => {
      if (!this.analyserNode || !this.analyserData) return;

      this.analyserNode.getFloatTimeDomainData(this.analyserData);

      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        const val = Math.abs(this.analyserData[i]);
        sumSquares += val * val;
        if (val > peak) peak = val;
      }

      const rms = Math.sqrt(sumSquares / this.analyserData.length);

      this.onAudioLevel?.({
        rms: Math.min(1, rms * 3), // amplify for visualization
        peak: Math.min(1, peak),
        timestamp: performance.now(),
      });

      this.levelAnimationId = requestAnimationFrame(meter);
    };

    this.levelAnimationId = requestAnimationFrame(meter);
  }

  private stopLevelMetering(): void {
    if (this.levelAnimationId !== null) {
      cancelAnimationFrame(this.levelAnimationId);
      this.levelAnimationId = null;
    }
  }

  /** Create AudioWorklet processor as blob URL */
  private createWorkletBlobURL(): string {
    const processorCode = `
      class PCM16CaptureProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          const vads = options.processorOptions.vads;
          this.bufferSize = options.processorOptions.chunkSize;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;

          // Barge-in detection settings
          this.bargeInArmed = false;
          this.sharedBargeInArray = null;

          // Thresholds from config
          this.thresholdSilent = vads.silentThreshold;
          this.requiredFrames = vads.requiredFrames;
          this.consecutiveFrames = 0;

          this.thresholdPlayback = vads.playbackThreshold;
          this.aecLeakageFactor = vads.aecLeakageFactor;
          this.windowSize = vads.windowSize;
          this.windowRequired = vads.windowRequired;
          this.frameWindow = new Uint8Array(this.windowSize);
          this.windowIndex = 0;
          this.windowCount = 0;

          this.port.onmessage = (e) => {
            if (e.data.type === 'barge-in-arm') {
              this.bargeInArmed = true;
              this.consecutiveFrames = 0;
              this.windowCount = 0;
              this.windowIndex = 0;
              this.frameWindow.fill(0);
            } else if (e.data.type === 'barge-in-disarm') {
              this.bargeInArmed = false;
            } else if (e.data.type === 'shared-buffer') {
              this.sharedBargeInArray = new Int32Array(e.data.buffer);
            }
          };
        }

        process(inputs) {
          const micChannel = inputs[0]?.[0];
          if (!micChannel) return true;

          const refChannel = inputs[1]?.[0];

          if (this.bargeInArmed) {
            const hasRef = refChannel && refChannel.length === micChannel.length;
            let micSum = 0;
            let refSum = 0;
            for (let i = 0; i < micChannel.length; i++) {
              micSum += micChannel[i] * micChannel[i];
              if (hasRef) refSum += refChannel[i] * refChannel[i];
            }
            const micRms = Math.sqrt(micSum / micChannel.length);
            const refRms = hasRef ? Math.sqrt(refSum / micChannel.length) : 0;

            const isPlayback = refRms > 0.005;
            let shouldTrigger = false;

            if (isPlayback) {
              const estimatedBleed = refRms * this.aecLeakageFactor;
              const excessRms = Math.max(0, micRms - estimatedBleed);
              const exceeds = excessRms > this.thresholdPlayback ? 1 : 0;

              this.windowCount += exceeds - this.frameWindow[this.windowIndex];
              this.frameWindow[this.windowIndex] = exceeds;
              this.windowIndex = (this.windowIndex + 1) % this.windowSize;

              shouldTrigger = this.windowCount >= this.windowRequired;
            } else {
              if (micRms > this.thresholdSilent) {
                this.consecutiveFrames++;
                shouldTrigger = this.consecutiveFrames >= this.requiredFrames;
              } else {
                this.consecutiveFrames = 0;
              }
            }

            if (shouldTrigger) {
              if (this.sharedBargeInArray) {
                Atomics.store(this.sharedBargeInArray, 0, 1);
              }
              this.port.postMessage({ type: 'barge-in' });
              this.bargeInArmed = false;
            }
          }

          // ── PCM16 capture (mic only, accumulate to chunk size) ──
          for (let i = 0; i < micChannel.length; i++) {
            this.buffer[this.bufferIndex++] = micChannel[i];

            if (this.bufferIndex >= this.bufferSize) {
              // Calculate energy of this chunk to decide if we should send it
              let sumSquares = 0;
              for (let j = 0; j < this.bufferSize; j++) {
                sumSquares += this.buffer[j] * this.buffer[j];
              }
              const rms = Math.sqrt(sumSquares / this.bufferSize);
              
              // Extremely low threshold (0.0001) to ensure we don't miss any speech, 
              // but still skip sending "digital zero" silence chunks.
              if (rms > 0.0001) {
                const int16 = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  const s = Math.max(-1, Math.min(1, this.buffer[j]));
                  int16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                this.port.postMessage({ type: 'audio-data', buffer: int16.buffer }, [int16.buffer]);
              }
              
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }
          }

          return true;
        }
      }

      registerProcessor('pcm16-capture', PCM16CaptureProcessor);
    `;

    const blob = new Blob([processorCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }
}