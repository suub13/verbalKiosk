/**
 * React step-detail components for 주민등록등본 (Resident Registration Certificate).
 * Extracted from WorkflowPanel — only resident-copy-specific UI lives here.
 */

import React from 'react';
import { useStore } from '@/store';
import type { ResidentCopyData, ApplyOptionGroup, ApplyOptionItem } from './residentCopy';
import { ISSUANCE_CHECKBOX_GROUPS, confirmResidentCopyOptions, cancelResidentCopyOptions } from './residentCopy';

/* ── Address step ── */
export function AddressDetail({ data }: { data: ResidentCopyData }) {
  return (
    <div>
      <h3 style={detailTitleStyle}>주민등록상 주소 입력</h3>
      <p style={detailDescStyle}>음성으로 시/도와 시/군/구를 말씀해 주세요.</p>
      <div style={cardStyle}>
        <FieldRow label="시 / 도" value={data.sido} />
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '10px 0' }} />
        <FieldRow label="시 / 군 / 구" value={data.sigungu} />
      </div>
      {!data.sido && <PulseHint text="음성 입력 대기 중..." />}
    </div>
  );
}

/* ── Type step ── */
export function TypeDetail({ data }: { data: ResidentCopyData }) {
  return (
    <div>
      <h3 style={detailTitleStyle}>발급형태 선택</h3>
      <p style={detailDescStyle}>기본발급과 선택발급 중 원하시는 형태를 음성으로 말씀해 주세요.</p>

      <div style={{ display: 'flex', gap: 20, marginTop: 24 }}>
        <TypeCard
          title="기본발급"
          desc="과거 주소 변동사항을 제외한 모든 정보가 표시됩니다. (예: 주민등록번호 뒷자리, 세대정보 등)"
          selected={data.issuanceType === 'basic'}
          color="#3b82f6"
        />
        <TypeCard
          title="선택발급"
          desc="발급 옵션을 직접 선택합니다. 표시할 항목을 터치로 선택해 주세요."
          selected={data.issuanceType === 'custom'}
          color="#7c3aed"
        />
      </div>

      {!data.issuanceType && <PulseHint text="음성 입력 대기 중..." />}
    </div>
  );
}

function TypeCard({ title, desc, selected, color }: { title: string; desc: string; selected: boolean; color: string }) {
  return (
    <div
      style={{
        flex: 1, padding: '24px', borderRadius: 16,
        border: `2px solid ${selected ? color : 'rgba(0,0,0,0.08)'}`,
        background: selected ? `${color}08` : '#fff',
        transition: 'all 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: `2px solid ${selected ? color : '#d1d5db'}`,
            background: selected ? color : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 200ms',
          }}
        >
          {selected && (
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, color: selected ? color : '#374151' }}>{title}</span>
      </div>
      <p style={{ margin: 0, fontSize: 18, color: '#6b7280', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

/* ── Options step (선택발급) — 발급 옵션 선택 UI ── */
export function OptionsDetail({ data }: { data: ResidentCopyData }) {
  const patchServiceData = useStore(s => s.patchServiceData);
  const goToWorkflowStep = useStore(s => s.goToWorkflowStep);

  const optionGroups: ApplyOptionGroup[] = data.pinoApplyOptionList ?? [];

  // ── 옵션 선택 화면
  return (
    <div>
      <h3 style={detailTitleStyle}>선택발급 옵션</h3>
      <p style={detailDescStyle}>표시할 항목을 선택한 후 다음 단계로 진행해 주세요.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {optionGroups.map((group, gi) => {
          if (group.groupCode === '30000100001') {
            return (
              <div key={group.groupCode} style={optionRowStyle}>
                <div style={optionLabelStyle}>{group.groupCodeName}</div>
                <div style={{ flex: 1, fontSize: 20, fontWeight: 600, color: '#1e293b' }}>
                  {data.sido && data.sigungu ? `${data.sido} ${data.sigungu}` : <span style={{ color: '#94a3b8' }}>주소 미입력</span>}
                  {!data.sigunguCode && data.sigungu && (
                    <div style={{ fontSize: 13, color: '#F59E0B', marginTop: 4 }}>⚠️ 코드 매핑 실패 — 주소를 다시 말씀해 주세요</div>
                  )}
                </div>
              </div>
            );
          }

          const sel = (data.customOptionSelections as Record<string, string[]>)?.[group.groupCode] ?? [];
          const isMulti = group.multiAbleAt === 'Y';

          const toggleCode = (code: string) => {
            const current = (data.customOptionSelections as Record<string, string[]>)?.[group.groupCode] ?? [];
            let next: string[];
            if (isMulti) {
              next = current.includes(code) ? current.filter((cv: string) => cv !== code) : [...current, code];
            } else {
              next = current.includes(code) ? [] : [code];
            }
            patchServiceData({ customOptionSelections: { ...(data.customOptionSelections as Record<string, string[]>), [group.groupCode]: next } });
          };

          return (
            <React.Fragment key={group.groupCode}>
              {gi > 0 && <div style={optionDividerStyle} />}
              <div style={optionRowStyle}>
                <div style={optionLabelStyle}>{group.groupCodeName}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: 1 }}>
                  {(group.childList as ApplyOptionItem[]).map((child: ApplyOptionItem) => {
                    const selected = sel.includes(child.code);
                    const isAutoInt = child.code === 'auto-int';
                    return (
                      <div key={child.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onMouseDown={e => { e.preventDefault(); if (!isAutoInt) toggleCode(child.code); else { patchServiceData({ customOptionSelections: { ...(data.customOptionSelections as Record<string, string[]>), [group.groupCode]: selected ? [] : [child.code] } }); } }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
                            border: `2px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                            background: selected ? '#EFF6FF' : '#fff', cursor: 'pointer',
                            fontSize: 18, fontWeight: selected ? 700 : 400, color: selected ? '#1d4ed8' : '#475569',
                            transition: 'all 150ms',
                          }}
                        >
                          {isMulti ? <CheckboxBox checked={selected} /> : <RadioDot selected={selected} />}
                          {child.name}
                        </button>
                        {isAutoInt && selected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number" min={1} max={99}
                              value={(data.addressHistoryYearsInput as string) ?? '1'}
                              onChange={e => patchServiceData({ addressHistoryYearsInput: e.target.value })}
                              style={{ width: 56, textAlign: 'center', fontSize: 18, fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 4px', outline: 'none', color: '#1e293b' }}
                            />
                            <span style={{ fontSize: 18, color: '#475569' }}>년</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 취소 / 다음 단계 버튼 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
        <button
          onMouseDown={e => { e.preventDefault(); cancelResidentCopyOptions(); }}
          style={{ flex: '0 0 150px', padding: '20px 0', borderRadius: 16, border: '2px solid #d1d5db', background: '#fff', color: '#64748b', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}
        >
          취소
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); goToWorkflowStep('sign'); }}
          style={{
            flex: 1, padding: '20px 0', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          }}
        >
          ✅ 선택 완료 → 전자서명
        </button>
      </div>
    </div>
  );
}

/* ── Sign step — 전자서명 방법 선택 + 서명 진행 ── */
export function SignDetail({ data }: { data: ResidentCopyData }) {
  const patchServiceData = useStore(s => s.patchServiceData);

  const SIGN_PROVIDERS = [
    { id: 'naver',  label: 'Naver',  emoji: '🟢', color: '#03C75A', activeColor: '#014E2C', bgColor: '#F0FDF4', borderColor: '#BBF7D0', waitingText: 'Naver 앱에서 전자서명 인증 요청을 확인하고 완료해 주세요.' },
    // { id: 'kakao', label: 'Kakao',  emoji: '🟡', color: '#FEE500', activeColor: '#3C1E1E', bgColor: '#FFFBEB', borderColor: '#FDE68A', waitingText: 'Kakao 앱에서 전자서명 인증 요청을 확인하고 완료해 주세요.' },
    // { id: 'toss',  label: 'Toss',   emoji: '🔵', color: '#0064FF', activeColor: '#001A66', bgColor: '#EFF6FF', borderColor: '#BFDBFE', waitingText: 'Toss 앱에서 전자서명 인증 요청을 확인하고 완료해 주세요.' },
  ];

  const [applyPhase, setApplyPhase] = React.useState<'select' | 'waiting' | 'done'>('select');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = React.useState<string>(SIGN_PROVIDERS[0].id);
  const [isLoading, setIsLoading] = React.useState(false);

  // Build applyOptionList from custom selections (options 단계에서 선택한 값)
  const buildApplyOptionList = () => {
    const groups: ApplyOptionGroup[] = data.pinoApplyOptionList ?? [];
    const result: { groupCode: string; groupCodeValue: string }[] = [];
    for (const group of groups) {
      const sel: string[] = (data.customOptionSelections as Record<string, string[]>)?.[group.groupCode] ?? [];
      if (group.requiredAt === 'Y') {
        if (group.groupCode === '30000100001') {
          // sigunguCode 우선, 없으면 childList에서 sido+sigungu로 매칭
          const code = data.sigunguCode as string | null
            ?? group.childList?.find((c: ApplyOptionItem) =>
                data.sido && data.sigungu &&
                (c.name === `${data.sido} ${data.sigungu}` || c.name.includes(data.sigungu as string))
              )?.code
            ?? null;
          if (code) result.push({ groupCode: group.groupCode, groupCodeValue: code });
          else if (data.sigungu) result.push({ groupCode: group.groupCode, groupCodeValue: data.sigungu as string });
        } else if (sel.length > 0) {
          result.push({ groupCode: group.groupCode, groupCodeValue: sel.join(', ') });
        }
      } else if (sel.length > 0) {
        if (group.multiAbleAt === 'Y') {
          result.push({ groupCode: group.groupCode, groupCodeValue: sel.join(', ') });
        } else {
          result.push({ groupCode: group.groupCode, groupCodeValue: sel[0] });
        }
      }
    }
    return result;
  };

  // ── tryDocApply: 단일 시도 → true(성공) / false(재시도 가능) / throw(치명적 오류)
  const tryDocApply = async (signToken: string): Promise<boolean> => {
    const res = await fetch('/api/pino/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accessToken': data.pinoAccessToken as string },
      body: JSON.stringify({ govDocId: data.pinoGovDocId, signToken }),
    });
    const json = await res.json();
    if (json.success) {
      setApplyPhase('done');
      const { pipelineBridge } = await import('@/services/pipelineBridge');
      // 출력단계 부환시 
      // pipelineBridge.sendOptionsConfirmed?.(JSON.stringify({ doc_issued: true, result: json.data }));  

      // 2) 완료 화면을 1.5초 보여준 후 navigate
      setTimeout(() => {
        const previewUrl = 'https://stg.pinokr.com:48450/kiosk/services/print/preview';
        if (window.parent !== window) {
          // iframe 안 → 부모에게 navigate 요청
          window.parent.postMessage({ action: 'navigate', url: previewUrl }, '*');
        } else {
          // 직접 접근 → 현재 탭 이동
          window.location.href = previewUrl;
        }
      }, 1500);
      // ── 기존 출력 프로세스 로직 (비활성화) ──────────────────────────
      // window.open(previewUrl, '_blank');
      // window.parent.postMessage({ action: 'close' }, '*');
      // window.close();
      // ─────────────────────────────────────────────────────────────────

      return true;
    }
    // 사용자가 아직 Naver 앱에서 승인 안 한 상태 → 재시도
    return false;
  };

  // ── pollDocApply: 사용자가 Naver 앱 승인할 때까지 polling (3초 간격, 최대 90초)
  const pollDocApply = async (signToken: string) => {
    const INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 70; // 210초 (3분 30초)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));
      try {
        const done = await tryDocApply(signToken);
        if (done) return; // 성공
      } catch (e: unknown) {
        // 네트워크 오류 등 일시적 실패 → 계속 재시도
      }
    }
    // 타임아웃
    setErrorMsg('인증 시간이 초과되었습니다. 처음부터 다시 시도해 주세요.');
    setApplyPhase('select');
  };

  // ── handleApplySign: Naver 버튼 클릭 → sign API → waiting 화면 → polling 시작
  const handleApplySign = async (providerId: string) => {
    if (!data.pinoAccessToken || !data.pinoGovDocId) {
      setErrorMsg('인증 정보가 없습니다. 본인인증을 다시 해주세요.'); return;
    }
    setIsLoading(true); setErrorMsg(null);
    try {
      const applyOptionList = buildApplyOptionList();
      const res = await fetch('/api/pino/apply/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accessToken': data.pinoAccessToken as string },
        body: JSON.stringify({
          govDocId: data.pinoGovDocId,
          providerId,
          userPhone: data.pinoPhone ?? '',
          applyOptionList,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? '전자서명 요청 실패');
      const signToken = json.data.signToken;
      patchServiceData({ pinoSignToken: signToken });
      setApplyPhase('waiting');
      // Naver 앱 승인 대기 후 polling으로 발급 (isLoading은 finally에서 해제)
      await pollDocApply(signToken);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setApplyPhase('select');
    } finally {
      setIsLoading(false);
    }
  };

  // ── 완료 화면 (App.tsx가 store.previewUrl을 감지해 전체화면 iframe으로 전환)
  if (applyPhase === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>전자서명 완료</h2>
        <p style={{ fontSize: 18, color: '#64748b' }}>전자증명서 발급이 완료되었습니다. 미리보기로 이동합니다...</p>
      </div>
    );
  }

  // ── 인증 대기 / 자동 처리 화면
  if (applyPhase === 'waiting') {
    const provider = SIGN_PROVIDERS.find(p => p.id === selectedProvider) ?? SIGN_PROVIDERS[0];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: 20 }}>
        <div style={{ fontSize: 52 }}>📲</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>{provider.emoji} {provider.label} 앱에서 인증을 완료해 주세요</h2>
        <p style={{ fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 1.7 }}>
          {provider.waitingText}
        </p>
        <div style={{ padding: '16px 32px', borderRadius: 12, background: provider.bgColor, border: `1px solid ${provider.borderColor}`, color: provider.activeColor, fontSize: 15, fontWeight: 600 }}>
          인증 완료 후 자동으로 진행됩니다
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 16 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Naver 앱 승인 대기 중...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        {errorMsg && (
          <div style={{
            width: '100%', maxWidth: 400,
            padding: '14px 18px', borderRadius: 12,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#DC2626', fontSize: 14, textAlign: 'center' as const, lineHeight: 1.6,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}
        <button
          onMouseDown={e => { e.preventDefault(); setApplyPhase('select'); setErrorMsg(null); }}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}
        >
          처음으로 돌아가기
        </button>
      </div>
    );
  }

  // ── 전자서명 방법 선택 화면 (버튼 클릭 시 즉시 신청)
  return (
    <div>
      <h3 style={detailTitleStyle}>전자서명</h3>
      <p style={detailDescStyle}>전자서명 방법을 선택하면 즉시 전자증명서가 신청됩니다.</p>

      <div style={{ padding: '20px 24px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>전자서명 방법 선택</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SIGN_PROVIDERS.map(provider => (
            <button
              key={provider.id}
              onMouseDown={e => { e.preventDefault(); if (!isLoading) { setSelectedProvider(provider.id); handleApplySign(provider.id); } }}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 12,
                border: `2px solid ${provider.color}`,
                background: provider.bgColor, cursor: isLoading ? 'not-allowed' : 'pointer', width: '100%',
                transition: 'all 150ms', opacity: isLoading ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', border: `2px solid ${provider.color}`,
                background: provider.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: provider.activeColor }}>
                {isLoading ? '신청 중...' : `${provider.emoji} ${provider.label}로 전자서명`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#DC2626', fontSize: 14 }}>⚠️ {errorMsg}</div>}
    </div>
  );
}

/* ── Option row helpers ── */

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${selected ? '#3b82f6' : '#cbd5e1'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 150ms',
    }}>
      {selected && <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6' }} />}
    </div>
  );
}

function CheckboxBox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
      border: `2px solid ${checked ? '#3b82f6' : '#cbd5e1'}`,
      background: checked ? '#3b82f6' : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 150ms',
    }}>
      {checked && (
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

const optionRowStyle: React.CSSProperties = {
  display: 'flex', gap: 24, padding: '22px 0', alignItems: 'flex-start',
};
const optionLabelStyle: React.CSSProperties = {
  width: 200, flexShrink: 0, fontSize: 21, fontWeight: 700, color: '#1e293b', paddingTop: 2,
};
const optionDividerStyle: React.CSSProperties = { height: 1, background: 'rgba(0,0,0,0.06)' };
function optionTextStyle(active: boolean): React.CSSProperties {
  return { fontSize: 21, fontWeight: active ? 600 : 400, color: active ? '#1e293b' : '#64748b' };
}

/* ── Shared UI helpers (duplicated from WorkflowPanel for isolation) ── */

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