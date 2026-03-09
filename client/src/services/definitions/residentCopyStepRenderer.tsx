/**
 * React step-detail components for 주민등록등본 (Resident Registration Certificate).
 * Extracted from WorkflowPanel — only resident-copy-specific UI lives here.
 */

import React from 'react';
import { useStore } from '@/store';
import type { ResidentCopyData } from './residentCopy';
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

/* ── Options step (선택발급) ── */
export function OptionsDetail({ data }: { data: ResidentCopyData }) {
  const patchServiceData = useStore(s => s.patchServiceData);

  return (
    <div>
      <h3 style={detailTitleStyle}>선택발급 옵션</h3>
      <p style={detailDescStyle}>표시할 항목을 선택한 후 "선택완료" 버튼을 눌러주세요.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* ── 과거의 주소 변동사항 (radio + input) ── */}
        <div style={optionRowStyle}>
          <div style={optionLabelStyle}>과거의 주소 변동사항</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', flex: 1 }}>
            <label
              onClick={() => patchServiceData({ addressHistoryMode: 'all' })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
            >
              <RadioDot selected={data.addressHistoryMode === 'all'} />
              <span style={optionTextStyle(data.addressHistoryMode === 'all')}>과거 주소 전체</span>
            </label>
            <label
              onClick={() => patchServiceData({ addressHistoryMode: 'custom' })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
            >
              <RadioDot selected={data.addressHistoryMode === 'custom'} />
              <span style={optionTextStyle(data.addressHistoryMode === 'custom')}>직접입력</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 21 }}>
                (
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={data.addressHistoryYears}
                  onChange={e => patchServiceData({ addressHistoryMode: 'custom', addressHistoryYears: parseInt(e.target.value) || 1 })}
                  onClick={() => patchServiceData({ addressHistoryMode: 'custom' })}
                  style={{
                    width: 48, textAlign: 'center', fontSize: 21, fontWeight: 600,
                    border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 2px',
                    outline: 'none', color: '#1e293b',
                  }}
                />
                ) 년
              </span>
            </label>
          </div>
        </div>

        <div style={optionDividerStyle} />

        {/* ── Checkbox groups ── */}
        {ISSUANCE_CHECKBOX_GROUPS.map((group, gi) => (
          <React.Fragment key={group.id}>
            <div style={optionRowStyle}>
              <div style={optionLabelStyle}>{group.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, flex: 1 }}>
                {group.options.map(opt => {
                  const checked = data.issuanceOptions[opt.id] ?? opt.defaultChecked;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => {
                        const current = data.issuanceOptions[opt.id] ?? opt.defaultChecked;
                        patchServiceData({ issuanceOptions: { ...data.issuanceOptions, [opt.id]: !current } });
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                    >
                      <CheckboxBox checked={checked} />
                      <span style={optionTextStyle(checked)}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {gi < ISSUANCE_CHECKBOX_GROUPS.length - 1 && <div style={optionDividerStyle} />}
          </React.Fragment>
        ))}
      </div>

      {/* 취소 / 선택완료 buttons */}
      <div style={{ display: 'flex', gap: 16, marginTop: 36 }}>
        <button
          onClick={() => cancelResidentCopyOptions()}
          style={{
            flex: '0 0 150px', padding: '20px 0', borderRadius: 16,
            border: '2px solid #d1d5db', background: '#fff', color: '#64748b',
            fontSize: 24, fontWeight: 700, cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          취소
        </button>
        <button
          onClick={() => confirmResidentCopyOptions()}
          style={{
            flex: 1, padding: '20px 0', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
            fontSize: 24, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)', transition: 'transform 100ms, box-shadow 100ms',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          선택완료
        </button>
      </div>
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
