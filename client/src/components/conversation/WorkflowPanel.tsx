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


import React, { useMemo } from 'react';
import { useStore } from '@/store';
import type { WorkflowStep, ConsentStatus } from '@/store/slices/conversationSlice';
import { getServiceDefinition } from '@/services/definitions/registry';
import { KioskIdentityForm } from '@/components/conversation/KioskIdentityForm';
import { pipelineBridge } from '@/services/pipelineBridge';

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
  const consentStatus   = useStore(s => s.consentStatus);

  const definition = getServiceDefinition(selectedServiceId);

  /* verify 단계 + 동의 완료(폼 입력) 시에만 상세 영역을 overflow:hidden 으로 전환 */
  const isVerifyFormPhase = currentStep === 'verify' && consentStatus === 'agreed';

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
   VerifyDetail — 2단계 UI
   ─────────────────────────────────────────────────────────────
   Phase 1 (pending / declined): 개인정보 수집 동의 안내 화면
     → AI 가 consentScript 를 읽고 동의 여부를 음성으로 확인
     → 동의하면 submit_identity_verification(consent:true) 호출
     → consentStatus='agreed' 로 변경되면 Phase 2 로 자동 전환
   Phase 2 (agreed): KioskIdentityForm 전체화면
     → 사용자가 키보드로 정보 입력 후 "본인인증 완료" 버튼 클릭
     → pipelineBridge 로 identity_completed 신호를 AI 에 전송
════════════════════════════════════════════════════════════ */
function VerifyDetail() {
  const reason = useStore(s => s.consentReason);
  const status = useStore(s => s.consentStatus) as ConsentStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getStore = () => useStore.getState() as any;

  /* ── Phase 2: 동의 완료 → KioskIdentityForm ── */
  if (status === 'agreed') {
    const handleComplete = (data: {
      name: string; rrnFront: string; rrnBack: string; phone: string; carrier: string;
    }) => {
      getStore().setPhoneNumber?.(data.phone);
      getStore().setPhoneVerified?.(true);
      /* sendOptionsConfirmed 채널 재사용 → realtimeProxy 가 identity_completed 신호를 AI 에 전달 */
      pipelineBridge.sendOptionsConfirmed?.(
        JSON.stringify({ identity_completed: true, phone: data.phone, carrier: data.carrier }),
      );
    };

    const handleCancel = () => {
      /* 취소 → Phase 1 로 복귀 */
      getStore().setConsentStatus?.('declined');
    };

    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <KioskIdentityForm onComplete={handleComplete} onCancel={handleCancel} />
      </div>
    );
  }

  /* ── Phase 1: 동의 대기 / 거부 ── */
  const statusColor = status === 'declined' ? '#dc2626' : '#d97706';
  const statusLabel = status === 'declined' ? '동의 거부' : '동의 대기 중';

  return (
    <div style={{ padding: '4px 0' }}>
      <h3 style={detailTitleStyle}>본인확인</h3>
      <p style={detailDescStyle}>{reason || '서류 발급'}을 위해 본인확인이 필요합니다.</p>

      {/* 상태 뱃지 */}
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '8px 20px', borderRadius: 24,
          background: `${statusColor}12`, border: `1px solid ${statusColor}30`,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            width: 10, height: 10, borderRadius: '50%', background: statusColor,
            animation: status === 'pending' ? 'wf-pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ fontSize: 20, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
      </div>

      {/* 수집 항목 카드 */}
      <div style={cardStyle}>
        <FieldRow label="수집 항목" value="이름, 주민등록번호, 통신사, 휴대전화번호" />
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '10px 0' }} />
        <FieldRow label="수집 목적" value="본인확인" />
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '10px 0' }} />
        <FieldRow label="보유 기간" value="세션 종료 시 즉시 삭제" />
      </div>

      {status === 'pending' && (
        <div style={{ marginTop: 20, fontSize: 20, color: '#475569', lineHeight: 1.6 }}>
          음성으로 <strong style={{ color: '#1e293b' }}>"동의합니다"</strong>라고 말씀해 주세요.
        </div>
      )}

      {status === 'declined' && (
        <div style={{ marginTop: 20, fontSize: 18, color: '#dc2626', lineHeight: 1.6,
          background: 'rgba(220,38,38,0.06)', padding: '14px 18px', borderRadius: 10 }}>
          동의를 거부하셨습니다. 서류 발급을 진행할 수 없습니다.
        </div>
      )}
    </div>
  );
}

/* ── Issue step (generic success) ── */
function IssueDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 72 }}>
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
      <h3 style={{ fontSize: 30, fontWeight: 700, color: '#16a34a', margin: '0 0 10px' }}>발급 완료</h3>
      <p style={{ fontSize: 21, color: '#6b7280' }}>서류가 출력되고 있습니다. 잠시만 기다려 주세요.</p>
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