/**
 * Main hook orchestrating voice pipeline selection and session management.
 * Coordinates between Realtime API (Service 1) and Cascaded (Service 2).
 */

import { useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { useAudioEngine } from './useAudioEngine';
import { useRealtimeAPI } from './useRealtimeAPI';
import type { PipelineMode } from '@shared/types/voice';
import { getErrorMessage } from '@shared/utils/errors';
import { pipelineBridge } from '@/services/pipelineBridge';

export function useVoicePipeline() {
  const {
    initialize: initAudio,
    isInitialized: isAudioReady,
    startCapture,
    stopCapture,
    stopPlayback,
  } = useAudioEngine();

  const { connect, disconnect, startStreaming, stopStreaming, cancelResponse } = useRealtimeAPI();

  const voiceState = useStore(s => s.voiceState);
  const pipelineMode = useStore(s => s.pipelineMode);
  const language = useStore(s => s.language);
  const workflowCurrentStep = useStore(s => s.workflowCurrentStep);
  const transition = useStore(s => s.transition);
  const setSession = useStore(s => s.setSession);
  const clearSession = useStore(s => s.clearSession);
  const setError = useStore(s => s.setError);

  /** Initialize audio and create session */
  const startSession = useCallback(async (mode: PipelineMode) => {
    try {
      // Initialize audio engine (requires user gesture)
      await initAudio();

      // Create backend session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          serviceType: mode === 'realtime' ? 'conversation' : 'document',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Session creation failed');

      setSession(data.data.sessionId, data.data.expiresAt);

      // Connect to appropriate pipeline
      if (mode === 'realtime') {
        const sessionId = useStore.getState().sessionId;
        await connect({
          sessionId: sessionId || undefined,
          language,
          turnDetection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 500,
            silence_duration_ms: 500,
          },
        });
        startStreaming();
        await startCapture();
        transition('listening');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [language, initAudio, connect, startStreaming, startCapture, transition, setSession, setError]);

  /** End current session and reset all state */
  const endSession = useCallback(async () => {
    const sessionId = useStore.getState().sessionId;

    // 1. Immediately reset UI and local state for responsiveness
    cancelResponse();
    stopStreaming();
    stopCapture();
    stopPlayback();

    // Disconnect the pipeline that is actually connected to OpenAI.
    pipelineBridge.disconnect?.();

    // Hard reset all store slices
    useStore.getState().reset();
    useStore.getState().resetConversation();
    transition('idle');

    // 2. Notify server in background (don't await)
    if (sessionId) {
      fetch(`/api/session/${sessionId}`, { method: 'DELETE' }).catch(err => {
        console.warn('[useVoicePipeline] Failed to delete session on server:', err);
      });
    }
  }, [cancelResponse, stopStreaming, stopCapture, stopPlayback, disconnect, clearSession, transition]);

  /** Toggle microphone mute */
  const toggleMute = useCallback(() => {
    const isMuted = useStore.getState().isMuted;
    useStore.getState().setMuted(!isMuted);

    if (isMuted) {
      startCapture();
    } else {
      stopCapture();
    }
  }, [startCapture, stopCapture]);



  /**
   * 발급 완료 후 자동 종료: AI 응답이 끝나고 'issue' 단계에서
   * 5초 동안 아무 동작이 없으면 세션을 자동 종료한다.
   */
  useEffect(() => {
    if (workflowCurrentStep !== 'issue') return;
    if (voiceState === 'speaking' || voiceState === 'processing') return;

    const timer = setTimeout(() => {
      if (useStore.getState().workflowCurrentStep === 'issue') {
        endSession();
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [workflowCurrentStep, voiceState, endSession]);



  return {
    voiceState,
    pipelineMode,
    isAudioReady,
    startSession,
    endSession,
    toggleMute,
  };
}

