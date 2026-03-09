import React from 'react';
import type { ClientServiceDefinition } from './types';
import { AddressDetail, TypeDetail, OptionsDetail } from './residentCopyStepRenderer';
import { useStore } from '@/store';
import { pipelineBridge } from '@/services/pipelineBridge';

export interface ResidentCopyData {
  sido: string | null;
  sigungu: string | null;
  issuanceType: 'basic' | 'custom' | null;
  issuanceOptions: Record<string, boolean>;
  addressHistoryMode: 'all' | 'custom';
  addressHistoryYears: number;
  pendingOptionCallId: string | null;
  [key: string]: unknown; // satisfies Record<string, unknown> assignment
}

export interface IssuanceOptionGroup {
  id: string;
  label: string;
  options: { id: string; label: string; defaultChecked: boolean }[];
}

export const ISSUANCE_CHECKBOX_GROUPS: IssuanceOptionGroup[] = [
  {
    id: 'compositionInfo',
    label: '세대 구성 정보',
    options: [
      { id: 'compositionReason', label: '세대 구성 사유', defaultChecked: false },
      { id: 'compositionDate', label: '세대 구성 일자', defaultChecked: true },
      { id: 'changeReason', label: '변동 사유', defaultChecked: false },
    ],
  },
  {
    id: 'memberInfo',
    label: '세대 구성원 정보',
    options: [
      { id: 'headRelation', label: '세대주와의 관계', defaultChecked: false },
      { id: 'cohabitant', label: '동거인', defaultChecked: false },
      { id: 'memberChangeReason', label: '변동사유', defaultChecked: false },
      { id: 'occurrenceDate', label: '발생일/신고일', defaultChecked: false },
      { id: 'otherMemberNames', label: '교부대상자 외 세대주·세대원·외국인 등의 이름', defaultChecked: false },
    ],
  },
  {
    id: 'residentId',
    label: '주민등록번호 뒷자리',
    options: [
      { id: 'residentIdSelf', label: '본인', defaultChecked: false },
      { id: 'residentIdFamily', label: '세대원', defaultChecked: false },
    ],
  },
];

/** Confirm custom issuance options — called from OptionsDetail UI */
export function confirmResidentCopyOptions(): void {
  const store = useStore.getState();
  const data = store.serviceData as ResidentCopyData;

  const payload = JSON.stringify({
    success: true,
    type: 'custom',
    options: data.issuanceOptions,
    addressHistory: data.addressHistoryMode === 'all'
      ? { mode: 'all' }
      : { mode: 'custom', years: data.addressHistoryYears },
  });

  // Try WebSocket first
  const sendWs = pipelineBridge.sendOptionsConfirmed;
  if (sendWs) {
    try { sendWs(payload); } catch { /* ignore */ }
  }
  // Always send REST fallback
  fetch('/api/realtime/options-confirmed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: payload }),
  }).catch(() => {});

  store.patchServiceData({ pendingOptionCallId: null });
  store.goToWorkflowStep('verify');
}

/** Cancel custom issuance options — called from OptionsDetail UI */
export function cancelResidentCopyOptions(): void {
  const store = useStore.getState();
  const cancelPayload = JSON.stringify({ success: false, cancelled: true });

  const sendWs = pipelineBridge.sendOptionsConfirmed;
  if (sendWs) {
    try { sendWs(cancelPayload); } catch { /* ignore */ }
  }
  fetch('/api/realtime/options-confirmed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: cancelPayload }),
  }).catch(() => {});

  store.patchServiceData({ pendingOptionCallId: null, issuanceType: null, issuanceOptions: {} });
  store.goToWorkflowStep('type');
}

export const residentCopyDefinition: ClientServiceDefinition = {
  id: 'resident-copy',
  name: '주민등록등본',

  getSteps(serviceData) {
    const d = serviceData as ResidentCopyData;
    return [
      { key: 'address', label: '주소 입력' },
      { key: 'type', label: '발급형태 선택' },
      ...(d.issuanceType !== 'basic'
        ? [{ key: 'options', label: '발급옵션 선택' }]
        : []),
      { key: 'verify', label: '본인확인' },
      { key: 'issue', label: '발급' },
    ];
  },

  renderStep(step, serviceData) {
    const d = serviceData as ResidentCopyData;
    switch (step) {
      case 'address': return React.createElement(AddressDetail, { data: d });
      case 'type':    return React.createElement(TypeDetail, { data: d });
      case 'options': return React.createElement(OptionsDetail, { data: d });
      default:        return null; // let WorkflowPanel handle verify, issue
    }
  },

  initialData: {
    sido: null,
    sigungu: null,
    issuanceType: null,
    issuanceOptions: {},
    addressHistoryMode: 'custom',
    addressHistoryYears: 1,
    pendingOptionCallId: null,
  } as ResidentCopyData,

  resetFromStep(step, data) {
    const stepResetOrder = ['address', 'type', 'options', 'verify', 'issue'];
    const targetIdx = stepResetOrder.indexOf(step);
    if (targetIdx < 0) return data;

    const stepsToReset = new Set(stepResetOrder.slice(targetIdx));
    const d = { ...data } as ResidentCopyData;

    if (stepsToReset.has('address')) {
      d.sido = null;
      d.sigungu = null;
    }
    if (stepsToReset.has('type')) {
      d.issuanceType = null;
    }
    if (stepsToReset.has('options')) {
      d.issuanceOptions = {};
      d.pendingOptionCallId = null;
      d.addressHistoryMode = 'custom';
      d.addressHistoryYears = 1;
    }
    return d;
  },

  functionHandlers: {
    // ── set_address ──────────────────────────────────────────────────────────
    set_address: (callId, args, ctx) => {
      const store = useStore.getState();
      const data = store.serviceData as ResidentCopyData;
      try {
        const parsed = JSON.parse(args);
        const hadSido = !!data.sido;
        const hasBothForCorrection = !!(parsed.sido && parsed.sigungu);

        if (hasBothForCorrection && hadSido) {
          ctx.setCorrectionStep('address_sigungu');
          ctx.setPendingCorrection(parsed.sigungu);
        } else if (hasBothForCorrection) {
          ctx.setCorrectionStep('address_sigungu');
          ctx.setPendingCorrection(parsed.sido + ' ' + parsed.sigungu);
        } else {
          ctx.setCorrectionStep('address_sido');
          ctx.setPendingCorrection(parsed.sido);
        }

        store.patchServiceData({ sido: parsed.sido, sigungu: parsed.sigungu || null });
        store.goToWorkflowStep('address');

        const hasBoth = !!(parsed.sido && parsed.sigungu);

        ctx.sendResult(callId, {
          success: true,
          sido: parsed.sido,
          sigungu: parsed.sigungu || null,
          addressComplete: hasBoth,
          nextAction: hasBoth
            ? `선택하신 주소는 "${parsed.sido} ${parsed.sigungu}"입니다. 사용자에게 주소를 확인해준 후("맞으시면 네라고...") 확인을 받은 다음, navigate_step("type")을 호출하고 발급형태(기본발급/선택발급)를 물어보세요.`
            : hadSido
              ? `시/도가 "${parsed.sido}"(으)로 변경되었습니다. 사용자에게 변경 사실을 확인해준 후("네, ${parsed.sido}(으)로 변경했습니다.") 시/군/구를 물어보세요.`
              : '시/군/구를 아직 입력받지 않았습니다. 반드시 시/군/구를 물어본 후 set_address를 다시 호출하세요.',
        });
      } catch {
        ctx.sendResult(callId, { success: false, error: 'Invalid arguments' });
      }
    },

    // ── set_issuance_type ────────────────────────────────────────────────────
    set_issuance_type: (callId, args, ctx) => {
      const store = useStore.getState();
      const data = store.serviceData as ResidentCopyData;

      if (!data.sido || !data.sigungu) {
        ctx.sendResult(callId, {
          success: false,
          error: '주소 입력이 완료되지 않았습니다. 먼저 set_address로 시/도와 시/군/구를 모두 입력받으세요.',
        });
        return;
      }

      try {
        const parsed = JSON.parse(args);
        const type = parsed.type as 'basic' | 'custom';

        ctx.setCorrectionStep('type');
        ctx.setPendingCorrection(type === 'basic' ? '기본발급' : '선택발급');

        if (type === 'basic') {
          store.patchServiceData({ issuanceType: 'basic' });
          store.goToWorkflowStep('type');
          ctx.sendResult(callId, {
            success: true, type: 'basic',
            message: '기본발급 선택됨.',
            guidance: '사용자에게 "기본발급으로 선택되었습니다. 이제 본인확인을 진행하겠습니다."라고 음성으로 안내한 후, navigate_step("verify")를 호출하고 request_identity_verification을 호출하세요.',
          });
        } else {
          // Initialize default options for custom issuance
          const opts: Record<string, boolean> = {};
          for (const group of ISSUANCE_CHECKBOX_GROUPS) {
            for (const o of group.options) {
              opts[o.id] = o.defaultChecked;
            }
          }
          store.patchServiceData({
            issuanceType: 'custom',
            issuanceOptions: opts,
            addressHistoryMode: 'custom',
            addressHistoryYears: 1,
          });
          store.goToWorkflowStep('options');
          ctx.sendResult(callId, {
            success: true, type: 'custom',
            message: '선택발급 선택됨. 화면에 발급 옵션이 표시되었습니다.',
            guidance: '사용자에게 "화면에서 표시할 항목을 선택한 후 완료 버튼을 눌러주세요."라고 음성으로 안내하세요. 사용자가 화면에서 선택을 완료할 때까지 기다리세요. 추가 함수 호출은 하지 마세요.',
          });
        }
      } catch {
        ctx.sendResult(callId, { success: false, error: 'Invalid arguments' });
      }
    },

  },

  stepLabels: {
    address: '주소 다시 입력',
    type: '발급형태 다시 선택',
    options: '발급옵션 다시 선택',
    verify: '본인확인 다시',
  },

  correctionRollback: {
    address_sido: (patchServiceData, goToWorkflowStep) => {
      patchServiceData({ sido: null, sigungu: null });
      goToWorkflowStep('address');
    },
    address_sigungu: (patchServiceData, goToWorkflowStep, serviceData) => {
      const d = serviceData as ResidentCopyData;
      patchServiceData({ sido: d.sido, sigungu: null });
      goToWorkflowStep('address');
    },
    type: (patchServiceData, goToWorkflowStep) => {
      patchServiceData({ issuanceType: null, issuanceOptions: {} });
      goToWorkflowStep('type');
    },
  },
};