/**
 * Main hook orchestrating voice pipeline session management.
 * Realtime API pipeline for voice issuance guide.
 */

import { useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { useStore } from '@/store';
import { useAudioEngine } from './useAudioEngine';
import { useRealtimeAPI } from './useRealtimeAPI';
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

  const { connect, disconnect, startStreaming, stopStreaming, cancelResponse, sendMicUnblock } = useRealtimeAPI();

  const voiceState = useStore(s => s.voiceState);
  const language = useStore(s => s.language);
  const workflowCurrentStep = useStore(s => s.workflowCurrentStep);
  const transition = useStore(s => s.transition);
  const setSession = useStore(s => s.setSession);
  const clearSession = useStore(s => s.clearSession);
  const setError = useStore(s => s.setError);

  /** Initialize audio and create session */
  const startSession = useCallback(async () => {
    try {
      // Initialize audio engine (requires user gesture)
      await initAudio();

      // Create backend session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          serviceType: 'conversation',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Session creation failed');

      setSession(data.data.sessionId, data.data.expiresAt);

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
      pipelineBridge.register({
        startCapture: () => { startCapture(); },
        stopCapture: () => { stopCapture(); },
      });
      startStreaming();
      await startCapture();
      transition('listening');
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
  const toggleMute = useCallback(async () => {
    const isMuted = useStore.getState().isMuted;
    useStore.getState().setMuted(!isMuted);

    if (isMuted) {
      sendMicUnblock();  // 서버 mic_blocked 해제
      startStreaming();  // 먼저 콜백 등록 후 캡처 시작
      await startCapture();
    } else {
      stopCapture();
      stopStreaming();
    }
  }, [startCapture, stopCapture, startStreaming, stopStreaming, sendMicUnblock]);



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

  /**
   * 마이크 비활성 단계(verify/options/sign/issue) 진입 시 마이크 자동 OFF.
   * 해당 단계에서 벗어나면 자동 ON.
   * 도움 버튼으로 isMuted가 외부에서 바뀌면 startCapture/stopCapture 반영.
   */
  const MIC_INACTIVE_STEPS = ['verify', 'options', 'sign', 'issue'];
  const isMuted = useStore(s => s.isMuted);

  // 단계 전환 시 마이크 제어
  // - 비활성 단계 진입: 무조건 OFF
  // - 비활성 → 활성 전환 시에만 ON (활성 → 활성은 skip)
  const prevStepRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!workflowCurrentStep) return;

    const prev = prevStepRef.current;
    prevStepRef.current = workflowCurrentStep;

    // 세션 시작 직후 첫 단계 — startSession()이 이미 처리
    if (prev === undefined) return;

    const isInactive = MIC_INACTIVE_STEPS.includes(workflowCurrentStep);
    const wasInactive = prev ? MIC_INACTIVE_STEPS.includes(prev) : false;

    if (isInactive) {
      // 비활성 단계 진입: 무조건 OFF
      stopCapture();
      stopStreaming();
      useStore.getState().setMuted(true);
    } else if (wasInactive) {
      // 비활성 → 활성 전환: 마이크 ON
      useStore.getState().setMuted(false);
      stopCapture();   // 혹시 남아있는 worklet 정리
      startStreaming();
      startCapture();
    }
    // 활성 → 활성 전환(address→type 등): 마이크 이미 열려있으므로 skip
  }, [workflowCurrentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // MicHelpButton 등 외부에서 isMuted 변경 시 캡처 + 스트리밍 제어
  // (비활성 단계 안에서만 동작)
  const isMutedRef = useRef(isMuted);
  useLayoutEffect(() => { isMutedRef.current = isMuted; });

  useEffect(() => {
    const isInactive = MIC_INACTIVE_STEPS.includes(workflowCurrentStep ?? '');
    if (!isInactive) return; // 활성 단계는 위 effect가 처리
    if (isMuted) {
      stopCapture();
      stopStreaming();
    } else {
      sendMicUnblock();
      startStreaming();
      startCapture();
    }
  }, [isMuted]); // eslint-disable-line react-hooks/exhaustive-deps



  /** 명시적 마이크 ON — isMuted 상태 무관하게 항상 열림 */
  const unmuteMic = useCallback(async () => {
    useStore.getState().setMuted(false);
    sendMicUnblock();
    startStreaming();
    await startCapture();
  }, [sendMicUnblock, startStreaming, startCapture]);

  /** 명시적 마이크 OFF */
  const muteMic = useCallback(() => {
    useStore.getState().setMuted(true);
    stopCapture();
    stopStreaming();
  }, [stopCapture, stopStreaming]);

  return {
    voiceState,
    isAudioReady,
    startSession,
    endSession,
    toggleMute,
    unmuteMic,
    muteMic,
  };
}