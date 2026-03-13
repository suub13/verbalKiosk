/**
 * Hook for Realtime API voice pipeline (Service 1).
 *
 * Function call → Workflow step mapping:
 *   goToWorkflowStep() auto-syncs the UI panel with the conversation.
 *   Steps before the target are auto-completed, steps after are auto-cleared.
 *
 * Correction rollback is delegated to the active service definition's
 * correctionRollback map — this hook has no hardcoded service logic.
 */

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeVoicePipeline } from '@/services/realtimeVoicePipeline';
import type { RealtimePipelineCallbacks } from '@/services/realtimeVoicePipeline';
import { useStore } from '@/store';
import type { WSSessionConfig } from '@shared/types/websocket';
import { TIMINGS } from '@/constants/timings';
import { pipelineBridge } from '@/services/pipelineBridge';
import { dispatchFunctionCall } from '@/services/functionCallDispatcher';
import { getServiceDefinition } from '@/services/definitions/registry';
// 기계음 재생을 위한 AudioEngine import
import { AudioEngine } from '@/services/audioEngine';


export function useRealtimeAPI() {
  const pipelineRef = useRef<RealtimeVoicePipeline | null>(null);
  const pendingCorrectionRef = useRef<{ corrected: string; targetMsgId: string } | null>(null);
  const correctionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAcceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptReceivedRef = useRef(false);
  const placeholderMsgIdRef = useRef<string | null>(null);
  const placeholderDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCorrectionContextRef = useRef<{ step: string } | null>(null);
  // [수정 후] AI 응답이 활성화된 상태인지 추적하는 플래그.
  // onPlaybackEnd 콜백에서 기계음을 재생할 때, 실제 AI 응답 종료 후인지 확인합니다.
  // 바지인 등으로 인한 playback 중단 시 기계음이 울리지 않도록 방지합니다.
  const aiResponseActiveRef = useRef(false);
  // AI 텍스트 transcript를 유저 transcript 도착 전까지 보류
  const aiTranscriptBufferRef = useRef<string>('');
  const aiTranscriptDoneRef = useRef<string | null>(null);
  const aiTranscriptHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transition = useStore(s => s.transition);
  const setPartialTranscript = useStore(s => s.setPartialTranscript);
  const setError = useStore(s => s.setError);
  const addMessage = useStore(s => s.addMessage);
  const voiceState = useStore(s => s.voiceState);

  useEffect(() => {
    /** 교정 컨텍스트 단계를 ref와 Zustand 스토어 양쪽에 설정 (HMR 생존을 위해 Zustand에도 저장) */
    function setCorrectionStep(step: string | null) {
      pendingCorrectionContextRef.current = step ? { step } : null;
      useStore.getState().setPendingCorrectionStep(step);
    }

    /**
     * 대기 중인 교정 텍스트 설정.
     * 트랜스크립트가 이미 수신된 경우 즉시 메시지에 교정 버블을 붙입니다.
     * 아직 수신 전이라면 pendingCorrectionRef에 저장하고 트랜스크립트 도착 시 처리합니다.
     */
    function setPendingCorrection(corrected: string) {
      const msgs = useStore.getState().messages;
      let targetMsgId = '';
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user' && msgs[i].audioTranscript) {
          targetMsgId = msgs[i].id;
          break;
        }
      }

      if (transcriptReceivedRef.current && targetMsgId) {
        useStore.getState().setCorrectionOnMessage(targetMsgId, corrected);
        // [수정 전] autoAcceptTimeoutRef: 8초 후 자동으로 "맞아요" 처리
        // → 제거됨: 사용자가 직접 버튼을 클릭하거나 음성으로 응답할 때까지 버블 유지
        return;
      }

      pendingCorrectionRef.current = { corrected, targetMsgId };
      transcriptReceivedRef.current = false;
      if (correctionTimeoutRef.current) clearTimeout(correctionTimeoutRef.current);
      // 트랜스크립트가 도착하지 않을 경우 폴백: CORRECTION_FALLBACK_MS 후 직접 메시지 추가
      correctionTimeoutRef.current = setTimeout(() => {
        if (pendingCorrectionRef.current && !transcriptReceivedRef.current) {
          const { corrected: text } = pendingCorrectionRef.current;
          if (placeholderMsgIdRef.current) {
            useStore.getState().updateMessageContent(placeholderMsgIdRef.current, text);
            placeholderMsgIdRef.current = null;
          } else {
            useStore.getState().addMessage('user', text, true);
          }
          pendingCorrectionRef.current = null;
        }
      }, TIMINGS.CORRECTION_FALLBACK_MS);
    }

    // ── [수정 후] AudioEngine의 onPlaybackEnd 콜백 등록 ──
    // AI 음성 재생이 완전히 끝났을 때(큐가 모두 소진된 후) 기계음을 재생합니다.
    // onPlaybackEnd는 playbackAborted=false일 때만 호출되므로
    // 바지인(사용자가 말을 끊음) 시에는 기계음이 울리지 않습니다.
    // [수정 전] onTranscriptDone에서 호출 → 텍스트 스트리밍 완료 시점이라 음성 재생 중일 수 있었음
    // [수정 후] onPlaybackEnd에서 호출 → 실제 음성 재생이 완전히 끝난 후 울림
    const audioEngine = AudioEngine.getInstance();
    audioEngine.setOnPlaybackEnd(() => {
      // aiResponseActiveRef로 실제 AI 응답 후 재생 종료인지 확인
      // (초기화 직후 빈 큐 등 spurious 호출 방지)
      if (aiResponseActiveRef.current) {
        aiResponseActiveRef.current = false;
        audioEngine.playMechanicalBeep();
        // 오디오 재생이 완전히 끝난 후 마이크 재개 (에코 방지)
        pipelineRef.current?.resumeAudioStreaming();
        // 아직 speaking 상태라면 listening으로 전환
        const currentState = useStore.getState().voiceState;
        if (currentState === 'speaking') {
          transition('listening');
        }
      }
    });

    /** 보류 중인 AI transcript 버퍼를 화면에 flush */
    function flushAiTranscript() {
      if (aiTranscriptHoldTimerRef.current) { clearTimeout(aiTranscriptHoldTimerRef.current); aiTranscriptHoldTimerRef.current = null; }
      const buffered = aiTranscriptBufferRef.current;
      aiTranscriptBufferRef.current = '';
      if (buffered) {
        setPartialTranscript(useStore.getState().partialTranscript + buffered);
      }
      const done = aiTranscriptDoneRef.current;
      aiTranscriptDoneRef.current = null;
      if (done !== null) {
        addMessage('assistant', done, true);
        setPartialTranscript('');
      }
    }

    const callbacks: RealtimePipelineCallbacks = {
      /** WebSocket 연결 상태 변경 처리 */
      onStateChange: (state) => {
        if (state === 'disconnected' && voiceState !== 'idle') {
          transition('idle');
        }
      },

      /** 사용자 발화 감지 시작: 트랜스크립트 수신 플래그 초기화 */
      onSpeechStarted: () => {
        transcriptReceivedRef.current = false;
        transition('listening');
      },

      /** 사용자 발화 종료: 처리 중 상태로 전환, 음성 인식 결과 도착까지 메시지 생성 안 함 */
      onSpeechStopped: () => {
        // AI 텍스트 버퍼 초기화 (새 발화 시작)
        aiTranscriptBufferRef.current = '';
        aiTranscriptDoneRef.current = null;
        if (aiTranscriptHoldTimerRef.current) { clearTimeout(aiTranscriptHoldTimerRef.current); aiTranscriptHoldTimerRef.current = null; }
        transition('processing');
      },

      /** AI 오디오 청크 수신: speaking 상태로 전환 */
      onAudioDelta: () => {
        const currentState = useStore.getState().voiceState;
        if (currentState !== 'speaking') {
          transition('speaking');
        }
        // AI 응답 오디오가 들어오고 있음을 표시
        aiResponseActiveRef.current = true;
      },

      onAudioDone: () => {},

      /** AI 텍스트 트랜스크립트 스트리밍 중: 유저 transcript 대기 중이면 버퍼에 보류 */
      onTranscriptDelta: (delta) => {
        if (transcriptReceivedRef.current) {
          // 유저 transcript 이미 도착 → 즉시 표시
          const current = useStore.getState().partialTranscript;
          setPartialTranscript(current + delta);
        } else {
          // 대기 중 → 버퍼에 누적
          aiTranscriptBufferRef.current += delta;
          // 첫 delta에서 5초 폴백 타이머 시작
          if (!aiTranscriptHoldTimerRef.current) {
            aiTranscriptHoldTimerRef.current = setTimeout(() => {
              flushAiTranscript();
            }, 5000);
          }
        }
      },

      /**
       * AI 텍스트 트랜스크립트 완료
       */
      onTranscriptDone: (transcript) => {
        if (transcriptReceivedRef.current) {
          addMessage('assistant', transcript, true);
          setPartialTranscript('');
        } else {
          // 유저 transcript 아직 미도착 → done도 보류
          aiTranscriptDoneRef.current = transcript;
        }
      },

      /** 사용자 음성 인식 완료: 플레이스홀더 메시지를 실제 텍스트로 교체 */
      onInputTranscript: (transcript) => {
        transcriptReceivedRef.current = true;
        // 보류 중인 AI transcript 버퍼 flush
        flushAiTranscript();
        if (placeholderDelayRef.current) {
          clearTimeout(placeholderDelayRef.current);
          placeholderDelayRef.current = null;
        }
        if (placeholderMsgIdRef.current) {
          useStore.getState().updateMessageContent(placeholderMsgIdRef.current, transcript);
          placeholderMsgIdRef.current = null;
        } else {
          addMessage('user', transcript, true);
        }
        // 대기 중이던 교정 텍스트가 있으면 메시지에 붙임
        if (pendingCorrectionRef.current) {
          const { corrected, targetMsgId } = pendingCorrectionRef.current;
          if (targetMsgId) {
            useStore.getState().setCorrectionOnMessage(targetMsgId, corrected);
          } else {
            useStore.getState().setCorrectionOnLastUserMessage(corrected);
          }
          pendingCorrectionRef.current = null;
          if (correctionTimeoutRef.current) {
            clearTimeout(correctionTimeoutRef.current);
            correctionTimeoutRef.current = null;
          }
          // [수정 전] autoAcceptTimeoutRef: 트랜스크립트 수신 후 8초 뒤 자동 "맞아요"
          // → 제거됨: 사용자가 직접 맞아요/아니요 버튼을 클릭하거나 음성으로 응답할 때까지 버블 유지
        }
      },

      /** 무음/잡음 등으로 필터링된 트랜스크립트 처리 (현재 무시) */
      onTranscriptionFiltered: () => {},

      /** AI가 호출한 함수를 클라이언트에서 처리 */
      onFunctionCall: (callId, name, args) => {
        const handled = dispatchFunctionCall(callId, name, args, {
          sendResult,
          setCorrectionStep,
          setPendingCorrection,
          addMessage,
        });
        if (!handled) {
          addMessage('system', `실행 중: ${name}`);
        }
      },

      /** AI 응답 완료: 오디오 없는 응답(function-call only)만 여기서 listening 전환 */
      onResponseDone: () => {
        setTimeout(() => {
          const currentState = useStore.getState().voiceState;
          // aiResponseActiveRef=true면 오디오 재생 중 → onPlaybackEnd에서 처리
          if (aiResponseActiveRef.current) return;
          if (currentState === 'speaking' || currentState === 'processing') {
            transition('listening');
          }
        }, TIMINGS.RESPONSE_DONE_TRANSITION_MS);
      },

      /** 오류 처리 */
      onError: (error, _code) => {
        setError(error);
      },
    };

    pipelineRef.current = new RealtimeVoicePipeline(callbacks);

    // 파이프라인 브리지에 WebSocket 통신 함수 등록
    pipelineBridge.register({
      sendFunctionResult: (callId: string, result: string) => {
        pipelineRef.current?.sendFunctionResult(callId, result);
      },
      sendOptionsConfirmed: (result: string) => {
        pipelineRef.current?.sendOptionsConfirmed(result);
      },
      disconnect: () => pipelineRef.current?.disconnect(),
      sendMicUnblock: () => pipelineRef.current?.sendMicUnblock(),
    });

    // 교정 거부(아니요) 시 롤백 핸들러 등록
    pipelineBridge.register({
      onCorrectionRejected: () => {
        const step = pendingCorrectionContextRef.current?.step
          || useStore.getState()._pendingCorrectionStep
          || undefined;

        if (step) {
          const store = useStore.getState();
          const definition = getServiceDefinition(store.selectedServiceId);
          const rollbackFn = definition?.correctionRollback?.[step];

          if (rollbackFn) {
            // 서비스 정의의 롤백 함수에 위임 (서비스별 상태 초기화)
            rollbackFn(
              (patch) => store.patchServiceData(patch),
              (s) => store.goToWorkflowStep(s),
              store.serviceData,
            );
          } else {
            // 공통 롤백: 서비스별 정의가 없는 경우
            if (step === 'verify') {
              store.setPhoneNumber(null);
              store.setPhoneVerified(false);
              store.setPrivacyConsented(false);
              store.setConsentStatus('pending');
              store.goToWorkflowStep('verify');
            } else if (step === 'fill') {
              // 양식 필드 롤백: 재질문으로 처리 (상태 초기화 불필요)
            } else if (step === 'service') {
              store.resetWorkflow();
            }
          }
        }

        // 교정 거부 이벤트를 서버에 전달 (WebSocket → REST 폴백)
        pipelineRef.current?.sendCorrectionRejection(step);
        const sessionId = useStore.getState().sessionId;
        fetch('/api/realtime/correction-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step, sessionId }),
        }).catch(() => {});
        setCorrectionStep(null);
      },
    });

    return () => {
      // 컴포넌트 언마운트 시 정리
      pipelineRef.current?.disconnect();
      pipelineBridge.clear();
      if (correctionTimeoutRef.current) clearTimeout(correctionTimeoutRef.current);
      if (autoAcceptTimeoutRef.current) clearTimeout(autoAcceptTimeoutRef.current);
      if (placeholderDelayRef.current) clearTimeout(placeholderDelayRef.current);
      // [수정 후] onPlaybackEnd 콜백 해제 (메모리 누수 방지)
      AudioEngine.getInstance().setOnPlaybackEnd(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** AI에게 함수 호출 결과를 반환 */
  function sendResult(callId: string, data: Record<string, unknown>) {
    pipelineRef.current?.sendFunctionResult(callId, JSON.stringify(data));
  }

  const connect = useCallback(async (config: WSSessionConfig) => {
    await pipelineRef.current?.connect(config);
  }, []);

  const disconnect = useCallback(() => {
    pipelineRef.current?.disconnect();
  }, []);

  const startStreaming = useCallback(() => {
    pipelineRef.current?.startAudioStreaming();
  }, []);

  const stopStreaming = useCallback(() => {
    pipelineRef.current?.stopAudioStreaming();
  }, []);

  const cancelResponse = useCallback(() => {
    pipelineRef.current?.cancelResponse();
  }, []);

  const sendMicUnblock = useCallback(() => {
    pipelineRef.current?.sendMicUnblock();
  }, []);

  return {
    pipeline: pipelineRef.current,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    cancelResponse,
    sendMicUnblock,
  };
}