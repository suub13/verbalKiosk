/**
 * WorkflowPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * 서류 발급 워크플로우 우측 패널.
 *
 * 레이아웃: 단계 사이드바(좌) + 단계 상세 영역(우)
 *
 * 서비스별 렌더링은 getServiceDefinition()에 위임하며,
 * 이 파일은 특정 서비스에 대한 하드코딩 없이 제네릭 폴백을 제공한다.
 *
 * ★ verify 단계 특이사항:
 *   - VerifyDetail 대신 KioskIdentityForm 을 렌더링한다.
 *   - 상세 영역이 overflow:hidden + flex 로 전체 높이를 채운다.
 *   - ConversationView 에서 이 단계일 때 패널을 100% 너비로 확장한다.
 */


import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import type { WorkflowStep } from '@/store/slices/conversationSlice';
import { getServiceDefinition } from '@/services/definitions/registry';
import { MicHelpButton } from '@/services/definitions/residentCopyStepRenderer';
import { KioskIdentityForm } from '@/components/conversation/KioskIdentityForm';
import { pipelineBridge } from '@/services/pipelineBridge';
import { issueBridge } from '@/services/issueBridge';

const GENERIC_STEPS = [
  { key: 'search', label: '서류 검색' },
  { key: 'verify', label: '본인확인' },
  { key: 'fill', label: '양식 작성' },
  { key: 'review', label: '확인 및 제출' },
];

export const WorkflowPanel: React.FC = () => {
  const currentStep = useStore(s => s.workflowCurrentStep);
  const completedSteps = useStore(s => s.workflowCompletedSteps);
  const selectedServiceId = useStore(s => s.selectedServiceId);
  const serviceData = useStore(s => s.serviceData);
  const formServiceName = useStore(s => s.formServiceName);

  const definition = getServiceDefinition(selectedServiceId);

  /* verify 단계 + 동의 완료(폼 입력) 시에만 상세 영역을 overflow:hidden 으로 전환 */
  // verify 단계에서는 항상 KioskIdentityForm을 전체 높이로 표시
  const isVerifyFormPhase = currentStep === 'verify';

  const steps = useMemo(
    () => definition ? definition.getSteps(serviceData) : GENERIC_STEPS,
    [definition, serviceData],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      {/* Header */}
      <div
        style={{
          padding: '26px 36px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e293b' }}>
          {formServiceName || '서류 발급'} 진행현황
        </h2>
      </div>

      {/* Body: steps (left) + detail (right) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Steps sidebar */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            padding: '32px 0',
            borderRight: '1px solid rgba(0,0,0,0.06)',
            background: '#fff',
            overflowY: 'auto',
          }}
        >
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.key);
            const isCurrent = currentStep === step.key;

            return (
              <div key={step.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 24px',
                    background: isCurrent ? 'rgba(59,130,246,0.06)' : 'transparent',
                    borderLeft: isCurrent ? '3px solid #3b82f6' : '3px solid transparent',
                    cursor: 'default',
                    transition: 'background 200ms',
                  }}
                >
                  <StepBadge index={idx + 1} completed={isCompleted} current={isCurrent} />
                  <span
                    style={{
                      fontSize: 21,
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCompleted ? '#16a34a' : isCurrent ? '#1e293b' : '#94a3b8',
                      transition: 'color 200ms',
                    }}
                  >
                    {step.label}
                  </span>
                  {isCompleted && (
                    <svg width={18} height={18} viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path d="M3 8.5L6.5 12L13 4" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Connector */}
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      marginLeft: 40,
                      width: 2,
                      height: 20,
                      background: isCompleted ? '#16a34a' : 'rgba(0,0,0,0.08)',
                      transition: 'background 200ms',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Detail area
            · verify 단계: overflow:hidden + flex 체인 → KioskIdentityForm 이 전체 높이 채움
            · 그 외 단계:  overflow:auto + 일반 패딩 (기존 동작 유지) */}
        <div
          style={{
            flex:          1,
            minHeight:     0,
            display:       'flex',
            flexDirection: 'column',
            overflowY:     isVerifyFormPhase ? 'hidden' : 'auto',
            padding:       isVerifyFormPhase ? 0 : '36px 40px',
          }}
        >
          {currentStep && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <StepDetail
                step={currentStep}
                definition={definition}
                serviceData={serviceData}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

/* ── Step badge ── */
function StepBadge({ index, completed, current }: { index: number; completed: boolean; current: boolean }) {
  const size = 36;
  if (completed) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%', background: '#16a34a',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `2px solid ${current ? '#3b82f6' : '#d1d5db'}`,
        background: current ? '#3b82f6' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 17, fontWeight: 700,
        color: current ? '#fff' : '#9ca3af',
        transition: 'all 200ms',
      }}
    >
      {index}
    </div>
  );
}

/* ── Step detail dispatcher ── */
interface StepDetailProps {
  step: WorkflowStep;
  definition: ReturnType<typeof getServiceDefinition>;
  serviceData: Record<string, unknown>;
}

function StepDetail({ step, definition, serviceData }: StepDetailProps) {
  // Try service-specific renderer first
  if (definition) {
    const rendered = definition.renderStep(step, serviceData);
    if (rendered !== null) return <>{rendered}</>;
  }

  // Generic fallback renderers
  switch (step) {
    case 'verify':  return <VerifyDetail />;
    case 'issue':   return <IssueDetail />;
    case 'search':  return <SearchDetail />;
    case 'fill':    return <FillDetail />;
    case 'review':  return <ReviewDetail />;
    default:        return null;
  }
}

/* ════════════════════════════════════════════════════════════
   VerifyDetail — Pino 본인인증 UI
   서류 선택 직후 바로 KioskIdentityForm 을 표시합니다.
   Step 1: 정보 입력 → /api/pino/identity/verify (SMS 발송)
   Step 2: 인증번호 입력 → /api/pino/identity/result (토큰 발급)
   완료 시 pipelineBridge 로 identity_verified 신호 전달
════════════════════════════════════════════════════════════ */
function VerifyDetail() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <KioskIdentityForm />
      <MicHelpButton />
    </div>
  );
}


/* ── Issue(출력) 단계 — 출력하기 버튼 인라인 표시 ── */
function IssueDetail() {
  const [printState, setPrintState] = useState<'waiting' | 'printing' | 'done'>(() =>
    issueBridge.isPending() ? 'waiting' : 'done'
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 출력하기 버튼 클릭 → printing 로딩 → confirm 후 done
  // done 상태: AI가 음성으로 질문, 사용자 음성 응답 대기
  // 10초 무응답 → 클라이언트가 직접 resetConversation (파이프라인 건드리지 않음)
  const handlePrint = useCallback(() => {
    setPrintState('printing');
    issueBridge.confirm(); // AI sendResult → AI가 음성으로 질문
    setTimeout(() => {
      setPrintState('done');
      // 10초 무응답 시 조용히 종료 (sendResult 재호출 없음 — 파이프라인 보호)
      timeoutRef.current = setTimeout(() => {
        useStore.getState().resetConversation();
      }, 10000);
    }, 2200);
  }, []);

  // 언마운트 시 타이머 정리 (reset_workflow / end_session 으로 컴포넌트가 내려갈 때)
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  /* ── 출력 중 로딩 화면 ── */
  if (printState === 'printing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, gap: 28 }}>
        <style>{`
          @keyframes print-roll {
            0%   { transform: translateY(0); opacity: 1; }
            40%  { transform: translateY(18px); opacity: 0.3; }
            60%  { transform: translateY(-18px); opacity: 0.3; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes print-bar {
            0%   { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes dot-blink {
            0%, 80%, 100% { opacity: 0; }
            40%            { opacity: 1; }
          }
        `}</style>

        {/* 프린터 아이콘 애니메이션 */}
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(59,130,246,0.18)',
          }}>
            <svg width={50} height={50} viewBox="0 0 24 24" fill="none">
              {/* 프린터 본체 */}
              <rect x="4" y="8" width="16" height="10" rx="2"
                fill="#3b82f6" opacity="0.15" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
              {/* 용지 위쪽 */}
              <path d="M8 8V5a1 1 0 011-1h6a1 1 0 011 1v3"
                stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* 용지 나오는 부분 — 애니메이션 */}
              <rect x="7" y="14" width="10" height="7" rx="1"
                fill="#fff" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"
                style={{ animation: 'print-roll 1.4s ease-in-out infinite' }}/>
              {/* 인쇄 선 */}
              <line x1="9" y1="16.5" x2="15" y2="16.5" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round"
                style={{ animation: 'print-roll 1.4s ease-in-out infinite' }}/>
              <line x1="9" y1="18.5" x2="13" y2="18.5" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round"
                style={{ animation: 'print-roll 1.4s ease-in-out infinite' }}/>
              {/* 상태 표시 점 */}
              <circle cx="17.5" cy="11" r="1.2" fill="#3b82f6"/>
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            출력 중
            <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4, verticalAlign: 'middle' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
                  animation: `dot-blink 1.2s ${i * 0.2}s infinite`,
                }}/>
              ))}
            </span>
          </h3>
          <p style={{ fontSize: 18, color: '#64748b', margin: 0 }}>서류를 출력하고 있습니다. 잠시만 기다려 주세요.</p>
        </div>

        {/* 진행바 */}
        <div style={{ width: '100%', maxWidth: 360, height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            animation: 'print-bar 2s ease-out forwards',
          }}/>
        </div>
      </div>
    );
  }

  /* ── 출력 완료 화면 ── */
  if (printState === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 72, gap: 12 }}>
        <style>{`
          @keyframes done-pop {
            0%   { transform: scale(0.7); opacity: 0; }
            70%  { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div style={{
          width: 100, height: 100, borderRadius: '50%', background: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          animation: 'done-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <svg width={50} height={50} viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 style={{ fontSize: 30, fontWeight: 700, color: '#16a34a', margin: 0 }}>출력 완료</h3>
        <p style={{ fontSize: 21, color: '#6b7280', margin: 0 }}>서류가 출력되었습니다.</p>
      </div>
    );
  }

  /* ── 출력 대기 화면 — 출력하기 버튼 인라인 ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: 20 }}>
      <div style={{ fontSize: 56 }}>🖨️</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', textAlign: 'center', margin: 0 }}>
        서류 출력 준비 완료
      </h2>
      <p style={{ fontSize: 18, color: '#64748b', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
        본인확인이 완료되었습니다.<br />
        아래 버튼을 눌러 서류를 출력해 주세요.
      </p>
      <div style={{
        padding: '14px 28px', borderRadius: 12,
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        color: '#1d4ed8', fontSize: 15, fontWeight: 600,
      }}>
        출력 버튼을 누르면 즉시 출력이 시작됩니다
      </div>
      <button
        onMouseDown={e => { e.preventDefault(); handlePrint(); }}
        style={{
          width: '100%', maxWidth: 420, padding: '22px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: '#fff', fontSize: 24, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        🖨️ 출력하기
      </button>
    </div>
  );
}

/* ── Generic: search ── */
function SearchDetail() {
  const serviceName = useStore(s => s.formServiceName);
  return (
    <div>
      <h3 style={detailTitleStyle}>서류 검색</h3>
      {serviceName ? (
        <div style={cardStyle}>
          <FieldRow label="선택된 서류" value={serviceName} />
        </div>
      ) : (
        <PulseHint text="서류를 검색하고 있습니다..." />
      )}
    </div>
  );
}

/* ── Generic: fill ── */
function FillDetail() {
  const currentForm = useStore(s => s.currentForm);
  const fieldDefs = useStore(s => s.formFieldDefinitions);

  const fields = useMemo(() => {
    if (!currentForm || fieldDefs.length === 0) return [];
    return fieldDefs.map(def => ({
      id: def.id,
      label: def.label,
      required: def.required,
      value: currentForm.fields[def.id] ?? '',
      completed: currentForm.completedFields.includes(def.id),
      isCurrent: currentForm.currentFieldId === def.id,
    }));
  }, [currentForm, fieldDefs]);

  const total = fields.length;
  const done = currentForm?.completedFields.length ?? 0;
  const progress = total > 0 ? done / total : 0;

  if (!currentForm) {
    return (
      <div>
        <h3 style={detailTitleStyle}>양식 작성</h3>
        <PulseHint text="양식을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div>
      <h3 style={detailTitleStyle}>양식 작성</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${progress * 100}%`,
              background: progress >= 1 ? '#16a34a' : '#3b82f6',
              borderRadius: 4, transition: 'width 300ms ease',
            }}
          />
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, color: '#475569' }}>{done}/{total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map(f => (
          <div
            key={f.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 12,
              background: f.isCurrent ? 'rgba(59,130,246,0.06)' : '#fff',
              border: `1.5px solid ${f.isCurrent ? '#3b82f6' : 'rgba(0,0,0,0.06)'}`,
              transition: 'all 200ms',
            }}
          >
            <div
              style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                border: f.completed ? 'none' : '2px solid #d1d5db',
                background: f.completed ? '#16a34a' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {f.completed && (
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span
              style={{
                flex: 1, fontSize: 20,
                fontWeight: f.isCurrent ? 600 : 400,
                color: f.isCurrent ? '#3b82f6' : f.completed ? '#94a3b8' : '#475569',
              }}
            >
              {f.label}
              {f.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
            </span>
            <span
              style={{
                fontSize: 20, maxWidth: 180, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: f.value ? '#1e293b' : '#94a3b8', fontWeight: f.value ? 500 : 400,
              }}
            >
              {f.value || (f.isCurrent ? '...' : '-')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Generic: review ── */
function ReviewDetail() {
  const currentForm = useStore(s => s.currentForm);
  if (currentForm?.status === 'submitted') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 72 }}>
        <div
          style={{
            width: 100, height: 100, borderRadius: '50%', background: '#dcfce7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}
        >
          <svg width={50} height={50} viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 style={{ fontSize: 30, fontWeight: 700, color: '#16a34a', margin: '0 0 10px' }}>제출 완료</h3>
        <p style={{ fontSize: 21, color: '#6b7280' }}>양식이 성공적으로 제출되었습니다.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 style={detailTitleStyle}>확인 및 제출</h3>
      <PulseHint text="입력 내용을 확인하고 있습니다..." />
    </div>
  );
}

/* ── Shared UI helpers ── */

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 20, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 21, color: value ? '#1e293b' : '#94a3b8', fontWeight: value ? 600 : 400 }}>
        {value || '-'}
      </span>
    </div>
  );
}

function PulseHint({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 20, fontSize: 20, color: '#94a3b8', animation: 'wf-pulse 1.5s infinite' }}>
      {text}
    </div>
  );
}

const detailTitleStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: 28, fontWeight: 700, color: '#1e293b' };
const detailDescStyle: React.CSSProperties = { margin: '0 0 20px', fontSize: 20, color: '#64748b', lineHeight: 1.6 };
const cardStyle: React.CSSProperties = {
  padding: '20px 28px', borderRadius: 14, background: '#fff',
  border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};