import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '@/store';
import { VoiceStateIndicator } from '@/components/voice/VoiceStateIndicator';
import { MessageBubble } from './MessageBubble';
import { WorkflowPanel } from './WorkflowPanel';
import { pipelineBridge } from '@/services/pipelineBridge';
import { issueBridge } from '@/services/issueBridge';

export function ConversationView() {
  /* ── store 구독 ── */
  const messages            = useStore(s => s.messages);
  const partialTranscript   = useStore(s => s.partialTranscript);
  const voiceState          = useStore(s => s.voiceState);
  const isWorkflowOpen      = useStore(s => s.isWorkflowOpen);
  const workflowCurrentStep = useStore(s => s.workflowCurrentStep); // 현재 단계 감지

  /* verify 단계 + 동의 완료(폼 입력 단계)일 때 우측 100% 확장 */
  const consentStatus = useStore(s => s.consentStatus);
  const isVerifyStep  = isWorkflowOpen && workflowCurrentStep === 'verify' && consentStatus === 'agreed';

  /* ── 발급 확인 모달 상태 (issueBridge 구독) ── */
  const [issuePending, setIssuePending] = useState(false);
  useEffect(() => issueBridge.subscribe(setIssuePending), []);

  /* ── 오답 수정 콜백 ── */
  const handleResolveCorrection = useCallback((messageId: string, accepted: boolean) => {
    useStore.getState().resolveCorrection(messageId, accepted);
    if (!accepted) {
      pipelineBridge.onCorrectionRejected?.();
    }
  }, []);

  const hasMessages = messages.length > 0;
  const scrollRef   = useRef<HTMLDivElement>(null);

  /* 새 메시지 도착 시 최하단으로 스크롤 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      className="conversation-view"
      style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}
    >
      {/* ──────────────────────────────────────────
          좌측: 대화창
          · verify 단계: display:none 으로 완전히 숨김
          · 워크플로우 열림: flex 0 0 50%
          · 워크플로우 닫힘: flex 1 (전체)
      ────────────────────────────────────────── */}
      <div
        style={{
          flex:          isVerifyStep ? '0 0 0%' : isWorkflowOpen ? '0 0 50%' : 1,
          display:       isVerifyStep ? 'none' : 'flex',
          minWidth:      0,
          flexDirection: 'column',
          position:      'relative',
          overflow:      'hidden',
          transition:    'flex 300ms ease',
        }}
      >
        {/* 스크롤 가능한 메시지 영역 */}
        <div
          ref={scrollRef}
          className="conversation-view__messages"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
        >
          {!hasMessages ? (
            /* 메시지 없음 — 음성 인디케이터 중앙 표시 */
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 56, paddingBottom: 56,
              }}
            >
              <VoiceStateIndicator />
              <p style={{ fontSize: 28, color: '#6b7280', marginTop: 20, textAlign: 'center', userSelect: 'none' }}>
                음성으로 말씀해 주세요
              </p>
            </div>
          ) : (
            <>
              {/* 메시지 있을 때 — 축소된 음성 인디케이터 */}
              <div
                style={{
                  display: 'flex', justifyContent: 'center',
                  padding: '10px 0 20px',
                  transform: 'scale(0.5)', transformOrigin: 'top center',
                  height: 170, flexShrink: 0,
                }}
              >
                <VoiceStateIndicator />
              </div>

              {/* 메시지 목록 */}
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  audioTranscript={msg.audioTranscript}
                  correction={msg.correction}
                  onResolveCorrection={
                    msg.correction?.status === 'pending'
                      ? (accepted) => handleResolveCorrection(msg.id, accepted)
                      : undefined
                  }
                />
              ))}

              <div style={{ height: 100, flexShrink: 0 }} />
            </>
          )}
        </div>

        {/* 음성 인식 중간 결과 오버레이 */}
        {(partialTranscript || voiceState === 'listening') && (
          <div
            className="conversation-view__transcript-overlay"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '20px 32px',
              background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span
                style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  background: voiceState === 'listening' ? '#3b82f6' : '#9ca3af',
                  animation: voiceState === 'listening' ? 'transcript-pulse 1.2s infinite' : 'none',
                }}
              />
              <span style={{ fontSize: 24, color: '#374151', fontStyle: partialTranscript ? 'normal' : 'italic' }}>
                {partialTranscript || '듣고 있습니다...'}
              </span>
            </div>
          </div>
        )}

        <style>{`
          @keyframes transcript-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>

      {/* ──────────────────────────────────────────
          우측: WorkflowPanel
          · verify 단계: flex 1 1 100% (전체 너비)
          · 그 외:       flex 0 0 50%
      ────────────────────────────────────────── */}
      {isWorkflowOpen && (
        <div
          style={{
            flex:       isVerifyStep ? '1 1 100%' : '0 0 50%',
            minWidth:   0,
            borderLeft: isVerifyStep ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
            overflow:   'hidden',
            transition: 'flex 300ms ease',
          }}
        >
          <WorkflowPanel />
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════
          발급 확인 모달 — issue_document 호출 시 중앙에 표시
          사용자가 "발급" 버튼을 눌러야 실제 발급 진행
      ════════════════════════════════════════════════════════════ */}
      {issuePending && (
        <div
          style={{
            position:       'absolute',
            inset:          0,
            background:     'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex:         200,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background:   '#ffffff',
              borderRadius: 24,
              padding:      '52px 60px',
              textAlign:    'center',
              boxShadow:    '0 20px 60px rgba(0,0,0,0.25)',
              maxWidth:     520,
              width:        '90%',
              animation:    'issueModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* 아이콘 */}
            <div
              style={{
                width:          80,
                height:         80,
                borderRadius:   '50%',
                background:     'rgba(59,130,246,0.1)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto 24px',
              }}
            >
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8"
                  stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>
              서류를 발급하시겠습니까?
            </h2>
            <p style={{ fontSize: 18, color: '#64748b', margin: '0 0 36px', lineHeight: 1.6 }}>
              본인확인이 완료되었습니다.<br/>
              아래 버튼을 눌러 서류를 발급해 주세요.
            </p>

            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={() => issueBridge.cancel()}
                style={{
                  flex:         1,
                  padding:      '18px 0',
                  borderRadius: 14,
                  fontSize:     18,
                  fontWeight:   600,
                  background:   '#f1f5f9',
                  border:       '1px solid rgba(0,0,0,0.08)',
                  color:        '#64748b',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                취소
              </button>
              <button
                onClick={() => issueBridge.confirm()}
                style={{
                  flex:         2,
                  padding:      '18px 0',
                  borderRadius: 14,
                  fontSize:     20,
                  fontWeight:   700,
                  background:   'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border:       'none',
                  color:        '#ffffff',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  boxShadow:    '0 4px 16px rgba(59,130,246,0.4)',
                }}
              >
                📄 발급하기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes issueModalIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}