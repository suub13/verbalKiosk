import { useStore } from '@/store';
import type { Message } from '@/store/slices/conversationSlice';
import { getServiceDefinition } from '@/services/definitions/registry';
import type { DispatchContext } from '@/services/definitions/types';
import { issueBridge } from '@/services/issueBridge';

// Re-export DispatchContext for callers that import it from here
export type { DispatchContext };

const SERVICE_NAME_MAP: Record<string, string> = {
  'resident-copy': '주민등록등본 발급',
  'health-insurance': '건강보험 자격득실 확인서 발급',
  'tax-certificate': '납세증명서 발급',
};

/** Generic fallback step keys (for unregistered services) */
const GENERIC_STEP_KEYS = ['search', 'verify', 'fill', 'review'];

/**
 * Dispatch a single client-handled function call.
 * Returns true if handled, false if unknown (caller should log).
 */
export function dispatchFunctionCall(
  callId: string,
  name: string,
  args: string,
  ctx: DispatchContext,
): boolean {
  const { sendResult, setCorrectionStep, setPendingCorrection, addMessage } = ctx;
  const store = useStore.getState();

  // ── 1. Service-specific handlers ─────────────────────────────────────────
  const definition = getServiceDefinition(store.selectedServiceId);
  if (definition?.functionHandlers?.[name]) {
    definition.functionHandlers[name]!(callId, args, ctx);
    return true;
  }

  // ── 2. Shared handlers ────────────────────────────────────────────────────

  // ── navigate_step → sync UI to step ──
  if (name === 'navigate_step') {
    try {
      const parsed = JSON.parse(args);
      const targetStep = parsed.step as string;

      // Build current step order from service definition
      const steps = definition
        ? definition.getSteps(store.serviceData).map(s => s.key)
        : GENERIC_STEP_KEYS;
      const stepLabels = definition?.stepLabels ?? {};

      const currentIdx = steps.indexOf(store.workflowCurrentStep || '');
      const targetIdx = steps.indexOf(targetStep);

      // Correction bubble on backward navigation
      if (stepLabels[targetStep] && targetIdx >= 0 && targetIdx < currentIdx) {
        setCorrectionStep('navigate');
        setPendingCorrection(stepLabels[targetStep]);
      }

      // Data reset: clear all data from target step onward
      if (targetIdx >= 0) {
        store.resetStepData(parsed.step);
        // Phone verification is in voiceSlice — reset if verify is being cleared
        if (steps.slice(targetIdx).includes('verify')) {
          store.setPhoneNumber(null);
          store.setPhoneVerified(false);
          store.setPrivacyConsented(false);
        }
      }

      // verify 단계로 이동 시 consentStatus를 'agreed'로 설정 → full-width 모드 활성화
      if (parsed.step === 'verify') {
        store.setConsentStatus('agreed');
      }

      // 마이크 비활성 단계 진입 시 voiceState를 idle로 전환
      const MIC_INACTIVE_STEPS = ['verify', 'options', 'sign', 'issue'];
      if (MIC_INACTIVE_STEPS.includes(parsed.step)) {
        const vs = store.voiceState;
        if (vs !== 'idle' && vs !== 'speaking' && vs !== 'error') {
          store.transition('speaking');
        }
      }

      store.goToWorkflowStep(parsed.step);

      const stepGuidance: Record<string, string> = {
        verify: '화면이 본인인증 단계로 전환되었습니다. 화면에 본인인증 폼이 표시되었습니다. 사용자에게 "이름, 생년월일, 주민번호 뒷자리 1자리, 통신사, 휴대폰 번호를 화면에 입력해 주세요"라고 안내하세요. 사용자가 인증번호를 받아 인증까지 완료하면 시스템 메시지가 전달됩니다. 완료 전까지 다음 function call을 호출하지 마세요.',
        issue: '화면이 출력 단계로 전환되었습니다. 사용자에게 "서류를 출력하시겠습니까? 출력하시려면 화면의 출력하기 버튼을 눌러주세요."라고 안내하고, 사용자가 버튼을 누를 때까지 기다리세요. issue_document를 직접 호출하지 마세요.',
        sign:  '화면이 전자서명 단계로 전환되었습니다. 화면에 전자서명 방법 선택 UI가 표시되어 있습니다. 사용자에게 "화면에서 전자서명 방법을 선택하고 전자증명서를 신청해 주세요."라고 안내하세요. 사용자가 전자서명을 완료하면 시스템 메시지가 전달됩니다. 완료 전까지 다음 함수를 호출하지 마세요.',
      };

      sendResult(callId, {
        success: true,
        step: parsed.step,
        ...(stepGuidance[parsed.step] ? { guidance: stepGuidance[parsed.step] } : {}),
      });
    } catch {
      sendResult(callId, { success: false, error: 'Invalid step' });
    }
    return true;
  }

  // ── Service detection (opens workflow) ──
  if (name === 'search_services' || name === 'get_service_details') {
    try {
      const parsed = JSON.parse(args);
      const query = (parsed.query || parsed.serviceId || '').toLowerCase();
      if (query.includes('주민등록등본') || query.includes('resident-copy') || parsed.serviceId === 'resident-copy') {
        setCorrectionStep('service');
        setPendingCorrection(SERVICE_NAME_MAP['resident-copy']);
        if (!store.selectedServiceId) {
          store.setSelectedService('resident-copy', '주민등록등본');
        }
        // 본인인증이 첫 번째 단계 → 마이크 비활성
        const vs1 = store.voiceState;
        if (vs1 !== 'idle' && vs1 !== 'speaking' && vs1 !== 'error') store.transition('speaking');
        store.goToWorkflowStep('verify');
      } else {
        const serviceId = parsed.serviceId || '';
        if (SERVICE_NAME_MAP[serviceId]) {
          setCorrectionStep('service');
          setPendingCorrection(SERVICE_NAME_MAP[serviceId]);
        }
        store.goToWorkflowStep('search');
      }
    } catch {
      store.goToWorkflowStep('search');
    }
    return true; // server-handled, no client result needed
  }

  // ── request_identity_verification → 'verify' step ──
  if (name === 'request_identity_verification') {
    try {
      const parsed = JSON.parse(args);
      store.setConsentReason(parsed.reason || '서류 발급');
    } catch {
      store.setConsentReason('서류 발급');
    }
    store.setConsentStatus('agreed');
    const vs2 = store.voiceState;
    if (vs2 !== 'idle' && vs2 !== 'speaking' && vs2 !== 'error') store.transition('speaking');
    store.goToWorkflowStep('verify');
    return true; // server-handled, no client result needed
  }

  // ── submit_identity_verification ──
  // consent=true  → consentStatus='agreed' 설정 → UI 에 KioskIdentityForm 표시
  //                 전화번호는 폼에서 직접 입력하므로 음성으로 묻지 않음
  // consent=false → consentStatus='declined' 설정
  if (name === 'submit_identity_verification') {
    try {
      const parsed = JSON.parse(args);
      setCorrectionStep('verify');
      setPendingCorrection(parsed.consent ? '동의합니다' : '동의하지 않습니다');

      if (parsed.consent) {
        store.setPrivacyConsented(true);
        store.setConsentStatus('agreed');
        sendResult(callId, {
          success: true,
          verified: false,
          awaiting_form: true,
          guidance:
            '사용자가 개인정보 수집에 동의하였습니다. ' +
            '화면에 본인인증 입력 폼이 표시되었습니다. ' +
            '"화면에서 이름, 주민등록번호, 통신사, 휴대폰 번호를 입력해 주세요."라고 안내하세요. ' +
            '사용자가 본인인증 완료 버튼을 누를 때까지 기다리세요. 입력 완료 시 시스템 메시지가 전달됩니다.',
        });
      } else {
        store.setConsentStatus('declined');
        sendResult(callId, {
          success: true,
          verified: false,
          guidance:
            '사용자가 동의하지 않았습니다. ' +
            '"개인정보 수집에 동의하지 않으시면 서류 발급을 진행할 수 없습니다. ' +
            '다른 도움이 필요하시면 말씀해 주세요."라고 음성으로 안내하세요.',
        });
        addMessage('system', '본인확인 동의가 거부되었습니다.');
      }
    } catch {
      sendResult(callId, { success: false, error: 'Invalid arguments' });
    }
    return true;
  }

    // ── issue_document → 출력 단계 화면으로 전환 + 출력하기 버튼 표시 ──
  // 즉시 출력 단계 화면으로 이동하고 사용자가 버튼 클릭 시 완료 안내
  if (name === 'issue_document') {
    // 1) pending 먼저 설정 → IssueDetail 마운트 시 isPending()=true 보장
    issueBridge.setPending(true, () => {
      sendResult(callId, {
        success: true,
        message: '서류가 출력되었습니다.',
        receiptNumber: `GOV-${Date.now().toString(36).toUpperCase()}`,
        guidance:
          '서류 출력이 완료되었습니다. ' +
          '반드시 사용자에게 음성으로 "출력이 완료되었습니다. 다른 서류가 필요하신가요?" 라고 질문하세요. ' +
          '사용자가 "있어요" 또는 추가 서류를 원하면 "네, 안내해드리겠습니다." 말한 후 reset_workflow()를 호출하세요. ' +
          '사용자가 "없어요" 또는 종료를 원하면 "이용해 주셔서 감사합니다. 안녕히 가세요." 말한 후 end_session()을 호출하세요. ' +
          '반드시 사용자 응답을 기다리세요. 절대로 자동으로 종료하거나 reset하지 마세요.',
      });
      addMessage('system', '서류 출력이 완료되었습니다.');
    });
    // 2) pending 설정 후 step 이동 → IssueDetail 마운트 시 isPending()=true 보장
    const vs3 = store.voiceState;
    if (vs3 !== 'idle' && vs3 !== 'speaking' && vs3 !== 'error') store.transition('speaking');
    store.goToWorkflowStep('issue');
    // 3) AI 에게 '출력하기 버튼을 눌러달라'고만 안내 — 완료 메시지는 버튼 클릭 후 전송됨
    sendResult(callId, {
      success: true,
      pending_user_action: true,
      guidance:
        '화면이 출력 단계로 전환되었습니다. ' +
        '사용자에게 "화면의 출력하기 버튼을 눌러주세요."라고 안내하세요. ' +
        '사용자가 버튼을 누를 때까지 기다리세요. ' +
        '이 시점에서 완료 멘트나 다음 안내를 하지 마세요. 버튼 클릭 안내만 하세요.',
    });
    return true;
  }


    // ── open_service_form → 'fill' step (generic) ──
  if (name === 'open_service_form') {
    try {
      const parsed = JSON.parse(args);
      store.initializeForm(parsed.serviceId, parsed.serviceName, parsed.fields || []);
      sendResult(callId, { success: true, message: 'Form displayed' });
    } catch {
      sendResult(callId, { success: false, error: 'Invalid arguments' });
    }
    return true;
  }

  // ── set_current_field → stays on 'fill' step ──
  if (name === 'set_current_field') {
    try {
      const parsed = JSON.parse(args);
      store.setCurrentFormField(parsed.fieldId);
      sendResult(callId, { success: true, fieldId: parsed.fieldId });
    } catch {
      sendResult(callId, { success: false, error: 'Invalid arguments' });
    }
    return true;
  }

  // ── fill_form_field → stays on 'fill' step ──
  if (name === 'fill_form_field') {
    try {
      const parsed = JSON.parse(args);
      store.updateFormField(parsed.fieldId, parsed.value);
      setCorrectionStep('fill');
      setPendingCorrection(parsed.value);
      sendResult(callId, { success: true, fieldId: parsed.fieldId, value: parsed.value });
    } catch {
      sendResult(callId, { success: false, error: 'Invalid arguments' });
    }
    return true;
  }

  // ── submit_form → 'review' step (generic) ──
  if (name === 'submit_form') {
    store.goToWorkflowStep('review');
    return true; // server-handled, no client result needed
  }

  // ── reset_workflow → close panel and reset service state ──
  if (name === 'reset_workflow') {
    setCorrectionStep(null);
    setPendingCorrection('처음부터 다시');
    store.resetWorkflow();
    sendResult(callId, { success: true, message: 'Workflow reset' });
    return true;
  }

  // ── end_session → 전체 종료 ──
  if (name === 'end_session') {
    sendResult(callId, { success: true });
    setTimeout(() => useStore.getState().resetConversation(), 1000);
    return true;
  }

  return false; // unknown function
}

// Make Message type available for callers that used to import it from here
export type { Message };