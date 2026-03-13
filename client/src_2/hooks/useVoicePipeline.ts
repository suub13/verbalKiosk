// /**
//  * Main hook orchestrating voice pipeline session management.
//  * Realtime API pipeline for voice issuance guide.
//  */

// import { useCallback, useEffect, useRef } from 'react';
// import { useStore } from '@/store';
// import { useAudioEngine } from './useAudioEngine';
// import { useRealtimeAPI } from './useRealtimeAPI';
// import { getErrorMessage } from '@shared/utils/errors';
// import { pipelineBridge } from '@/services/pipelineBridge';

// export function useVoicePipeline() {
//   const {
//     initialize: initAudio,
//     isInitialized: isAudioReady,
//     startCapture,
//     stopCapture,
//     stopPlayback,
//   } = useAudioEngine();

//   const { connect, disconnect, startStreaming, stopStreaming, cancelResponse, sendMicUnblock } = useRealtimeAPI();

//   const voiceState = useStore(s => s.voiceState);
//   const language = useStore(s => s.language);
//   const workflowCurrentStep = useStore(s => s.workflowCurrentStep);
//   const transition = useStore(s => s.transition);
//   const setSession = useStore(s => s.setSession);
//   const clearSession = useStore(s => s.clearSession);
//   const setError = useStore(s => s.setError);

//   /** Initialize audio and create session */
//   const startSession = useCallback(async () => {
//     try {
//       // Initialize audio engine (requires user gesture)
//       await initAudio();

//       // Create backend session
//       const res = await fetch('/api/session', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           language,
//           serviceType: 'conversation',
//         }),
//       });

//       const data = await res.json();
//       if (!data.success) throw new Error(data.error?.message || 'Session creation failed');

//       setSession(data.data.sessionId, data.data.expiresAt);

//       const sessionId = useStore.getState().sessionId;
//       await connect({
//         sessionId: sessionId || undefined,
//         language,
//         turnDetection: {
//           type: 'server_vad',
//           threshold: 0.5,
//           prefix_padding_ms: 500,
//           silence_duration_ms: 500,
//         },
//       });
//       startStreaming();
//       await startCapture();
//       transition('listening');
//     } catch (err) {
//       setError(getErrorMessage(err));
//     }
//   }, [language, initAudio, connect, startStreaming, startCapture, transition, setSession, setError]);

//   /** End current session and reset all state */
//   const endSession = useCallback(async () => {
//     const sessionId = useStore.getState().sessionId;

//     // 1. Immediately reset UI and local state for responsiveness
//     cancelResponse();
//     stopStreaming();
//     stopCapture();
//     stopPlayback();

//     // Disconnect the pipeline that is actually connected to OpenAI.
//     pipelineBridge.disconnect?.();

//     // Hard reset all store slices
//     useStore.getState().reset();
//     useStore.getState().resetConversation();
//     transition('idle');

//     // 2. Notify server in background (don't await)
//     if (sessionId) {
//       fetch(`/api/session/${sessionId}`, { method: 'DELETE' }).catch(err => {
//         console.warn('[useVoicePipeline] Failed to delete session on server:', err);
//       });
//     }
//   }, [cancelResponse, stopStreaming, stopCapture, stopPlayback, disconnect, clearSession, transition]);


//   /** Toggle microphone mute */
//   const toggleMute = useCallback(async () => {
//     const isMuted = useStore.getState().isMuted;
//     useStore.getState().setMuted(!isMuted);

//     if (isMuted) {
//       sendMicUnblock();  // 서버 mic_blocked 해제
//       startStreaming();  // 먼저 콜백 등록 후 캡처 시작
//       await startCapture();
//     } else {
//       stopCapture();
//       stopStreaming();
//     }
//   }, [startCapture, stopCapture, startStreaming, stopStreaming, sendMicUnblock]);



//   /**
//    * 발급 완료 후 자동 종료: AI 응답이 끝나고 'issue' 단계에서
//    * 5초 동안 아무 동작이 없으면 세션을 자동 종료한다.
//    */
//   useEffect(() => {
//     if (workflowCurrentStep !== 'issue') return;
//     if (voiceState === 'speaking' || voiceState === 'processing') return;

//     const timer = setTimeout(() => {
//       if (useStore.getState().workflowCurrentStep === 'issue') {
//         endSession();
//       }
//     }, 10000);

//     return () => clearTimeout(timer);
//   }, [workflowCurrentStep, voiceState, endSession]);

//   /**
//    * 마이크 비활성 단계(verify/options/sign/issue) 진입 시 마이크 자동 OFF.
//    * 해당 단계에서 벗어나면 자동 ON.
//    * 도움 버튼으로 isMuted가 외부에서 바뀌면 startCapture/stopCapture 반영.
//    */
//   const MIC_INACTIVE_STEPS = ['verify', 'options', 'sign', 'issue'];

//   const isMuted = useStore(s => s.isMuted);
//   const micMutedForInactiveRef = useRef(false);

//   // 마이크 비활성 단계 진입/이탈 시 마이크 제어
//   useEffect(() => {
//   const isInactive = MIC_INACTIVE_STEPS.includes(workflowCurrentStep ?? '');
//   if (isInactive && !micMutedForInactiveRef.current) {
//     micMutedForInactiveRef.current = true;
//     stopCapture();
//     stopStreaming();          // ← 추가: streaming도 함께 중단
//     useStore.getState().setMuted(true);
//   } else if (!isInactive && micMutedForInactiveRef.current) {
//     // ★ 버그 수정: ref를 false로 먼저 바꾸면 isMuted 이펙트의 guard가
//     //   통과되지 않아 startStreaming()이 호출되지 않는 문제.
//     //   이 이펙트에서 직접 sendMicUnblock + startStreaming + startCapture 모두 호출.
//     micMutedForInactiveRef.current = false;
//     useStore.getState().setMuted(false);
//     sendMicUnblock();         // ← 추가
//     startStreaming();          // ← 추가 (핵심 수정)
//     startCapture();
//   }
// }, [workflowCurrentStep, stopCapture, stopStreaming, startCapture, startStreaming, sendMicUnblock]);

//   // 도움 버튼 등 외부에서 isMuted 변경 시 캡처 + 스트리밍 제어
//   useEffect(() => {
//     if (!micMutedForInactiveRef.current) return; // 마이크 비활성 단계에서만 적용
//     if (isMuted) {
//       stopCapture();
//       stopStreaming();
//     } else {
//       sendMicUnblock();
//       startStreaming();
//       startCapture();
//     }
//   }, [isMuted, stopCapture, startCapture, startStreaming, stopStreaming, sendMicUnblock]);



//   /** 명시적 마이크 ON — isMuted 상태 무관하게 항상 열림 */
//   const unmuteMic = useCallback(async () => {
//     useStore.getState().setMuted(false);
//     sendMicUnblock();
//     startStreaming();
//     await startCapture();
//   }, [sendMicUnblock, startStreaming, startCapture]);

//   /** 명시적 마이크 OFF */
//   const muteMic = useCallback(() => {
//     useStore.getState().setMuted(true);
//     stopCapture();
//     stopStreaming();
//   }, [stopCapture, stopStreaming]);

//   return {
//     voiceState,
//     isAudioReady,
//     startSession,
//     endSession,
//     toggleMute,
//     unmuteMic,
//     muteMic,
//   };
// }

/**
 * Main hook orchestrating voice pipeline session management.
 * Realtime API pipeline for voice issuance guide.
 */

import { useCallback, useEffect, useRef } from 'react';
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

  // ── MicHelpButton에서 쓸 unmuteMic / muteMic을 pipelineBridge에 등록
  // startCapture가 useAudioEngine 소속이라 여기서 등록해야 함
  useEffect(() => {
    pipelineBridge.register({
      unmuteMic: async () => {
        useStore.getState().setMuted(false);
        sendMicUnblock();
        startStreaming();
        await startCapture();
      },
      muteMic: () => {
        useStore.getState().setMuted(true);
        stopCapture();
        stopStreaming();
      },
    });
  }, [sendMicUnblock, startStreaming, startCapture, stopCapture, stopStreaming]);
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
  const micMutedForInactiveRef = useRef(false);

  // 마이크 비활성 단계 진입/이탈 시 마이크 제어
  useEffect(() => {
    const isInactive = MIC_INACTIVE_STEPS.includes(workflowCurrentStep ?? '');
    if (isInactive) {
      // 비활성 단계 진입 (또는 비활성 단계 간 이동) 시 항상 마이크 OFF 보장
      // verify→options→sign 처럼 비활성→비활성 이동 시에도 ref가 이미 true이므로
      // 여기서 무조건 stopCapture/stopStreaming/setMuted(true) 실행
      micMutedForInactiveRef.current = true;
      stopCapture();
      stopStreaming();
      useStore.getState().setMuted(true);
    } else if (!isInactive && micMutedForInactiveRef.current) {
      // 비활성 단계 이탈 시 마이크 ON
      micMutedForInactiveRef.current = false;
      useStore.getState().setMuted(false);
      sendMicUnblock();
      startStreaming();
      startCapture();
    }
  }, [workflowCurrentStep, stopCapture, stopStreaming, startCapture, startStreaming, sendMicUnblock]);

  // 도움 버튼 등 외부에서 isMuted 변경 시 캡처 + 스트리밍 제어
  useEffect(() => {
    if (!micMutedForInactiveRef.current) return; // 마이크 비활성 단계에서만 적용
    if (isMuted) {
      stopCapture();
      stopStreaming();
    } else {
      sendMicUnblock();
      startStreaming();
      startCapture();
    }
  }, [isMuted, stopCapture, startCapture, startStreaming, stopStreaming, sendMicUnblock]);



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