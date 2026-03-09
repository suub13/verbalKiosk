/**
 * functionCallDispatcher — handles all client-side function calls from the AI.
 *
 * Dispatch order:
 *   1. Service-specific handlers (from getServiceDefinition().functionHandlers)
 *   2. Shared handlers (navigate_step, identity verification, issue, form, etc.)
 *
 * To add handlers for a new service: put them in that service's definition file.
 * No changes needed here.
 */

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

      store.goToWorkflowStep(parsed.step);

      const stepGuidance: Record<string, string> = {
        verify: '화면이 본인확인 단계로 전환되었습니다. 반드시 request_identity_verification을 호출하여 개인정보 수집 동의 안내를 음성으로 시작하세요.',
        issue: '화면이 발급 단계로 전환되었습니다. issue_document를 호출하세요.',
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
        store.goToWorkflowStep('address');
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

  // ── issue_document → 발급 확인 모달 표시 (ConversationView 중앙) ──
  // issueBridge 를 통해 중앙 확인 모달을 열고,
  // 사용자가 "발급" 버튼을 누를 때만 실제로 issue 단계로 진행한다.
  if (name === 'issue_document') {
    issueBridge.setPending(true, () => {
      store.goToWorkflowStep('issue');
      sendResult(callId, {
        success: true,
        message: '서류가 발급되었습니다.',
        receiptNumber: `GOV-${Date.now().toString(36).toUpperCase()}`,
        guidance:
          '서류 발급이 완료되었습니다. ' +
          '사용자에게 다음 두 문장을 순서대로 음성으로 안내해 주세요. ' +
          '첫째: "출력되었습니다." ' +
          '둘째: "다른 도움이 필요하세요? 필요하지 않으시면 종료 버튼을 눌러주세요."',
      });
      addMessage('system', '서류 발급이 완료되었습니다.');
    });
    // AI 에게 모달이 열렸음을 즉시 알림 (무한 대기 방지)
    sendResult(callId, {
      success: true,
      pending_confirmation: true,
      guidance:
        '화면에 발급 확인 모달이 표시되었습니다. ' +
        '사용자에게 "화면에서 발급 버튼을 눌러주세요."라고 안내하세요.',
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

  return false; // unknown function
}

// Make Message type available for callers that used to import it from here
export type { Message };