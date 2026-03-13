/**
 * Conversation slice - Manages chat messages, form state, and workflow progress.
 *
 * Workflow sync mechanism:
 *   goToWorkflowStep(step) is the SINGLE source of truth for step transitions.
 *   - Steps before `step` are auto-completed.
 *   - Steps at/after `step` are auto-cleared.
 *   - Works forward AND backward (e.g. "주소 다시 입력" resets to address step).
 *
 * Service-specific state lives in `serviceData` (a generic pocket).
 * Each service definition (client/src/services/definitions/) owns its own data shape.
 * conversationSlice has no knowledge of specific service fields (sido, issuanceType, etc.).
 */

import type { StateCreator } from 'zustand';
import type { FormData, FormFieldDefinition } from '@shared/types/civilService';
import { getServiceDefinition } from '@/services/definitions/registry';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  audioTranscript?: boolean;
  correction?: {
    text: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
}

function shouldShowCorrection(original: string, corrected: string): boolean {
  const norm = (s: string) => s
    .replace(/[\s,.\-!?~요이에는을를가의로네예]/g, '')
    .toLowerCase();
  return norm(original) !== norm(corrected);
}

/** WorkflowStep is string — each service definition declares its own step keys */
export type WorkflowStep = string;

export type ConsentStatus = 'pending' | 'agreed' | 'declined';

/** Generic fallback step keys for unregistered services */
const GENERIC_STEP_KEYS: WorkflowStep[] = ['search', 'verify', 'fill', 'review'];

export interface ConversationSlice {
  messages: Message[];

  // Workflow
  isWorkflowOpen: boolean;
  workflowCurrentStep: WorkflowStep | null;
  workflowCompletedSteps: WorkflowStep[];

  // Selected service
  selectedServiceId: string | null;
  formServiceName: string | null;

  /**
   * Service-specific data pocket.
   * Shape is owned by the active service definition (e.g. ResidentCopyData).
   * Read as `serviceData as ResidentCopyData` inside service-specific code.
   */
  serviceData: Record<string, unknown>;

  // Form (generic services)
  currentForm: FormData | null;
  formFieldDefinitions: FormFieldDefinition[];

  // Consent
  consentReason: string | null;
  consentStatus: ConsentStatus;

  /** Step context for pending correction (survives HMR unlike refs) */
  _pendingCorrectionStep: string | null;
  setPendingCorrectionStep: (step: string | null) => void;

  // ── Core workflow sync action ──
  goToWorkflowStep: (step: WorkflowStep) => void;

  // Actions - messages
  addMessage: (role: Message['role'], content: string, audioTranscript?: boolean) => string;
  removeMessage: (messageId: string) => void;
  updateMessageContent: (messageId: string, content: string) => void;
  setCorrectionOnLastUserMessage: (correctedText: string) => void;
  setCorrectionOnMessage: (messageId: string, correctedText: string) => void;
  resolveCorrection: (messageId: string, accepted: boolean) => void;
  clearMessages: () => void;

  // Actions - workflow helpers
  openWorkflow: (step: WorkflowStep) => void;
  closeWorkflow: () => void;

  // Actions - service selection
  setSelectedService: (serviceId: string, serviceName: string) => void;

  // Actions - service data (generic)
  setServiceData: (data: Record<string, unknown>) => void;
  patchServiceData: (patch: Partial<Record<string, unknown>>) => void;

  // Actions - form (generic)
  setCurrentForm: (form: FormData | null) => void;
  updateFormField: (fieldId: string, value: string) => void;
  initializeForm: (serviceId: string, serviceName: string, fields: FormFieldDefinition[]) => void;
  setCurrentFormField: (fieldId: string | undefined) => void;

  // Actions - consent
  setConsentReason: (reason: string) => void;
  setConsentStatus: (status: ConsentStatus) => void;

  // Reset
  resetStepData: (fromStep: WorkflowStep) => void;
  resetWorkflow: () => void;
  resetConversation: () => void;
}

const initialConversationState = {
  messages: [] as Message[],
  isWorkflowOpen: false,
  workflowCurrentStep: null as WorkflowStep | null,
  workflowCompletedSteps: [] as WorkflowStep[],
  selectedServiceId: null as string | null,
  formServiceName: null as string | null,
  serviceData: {} as Record<string, unknown>,
  currentForm: null as FormData | null,
  formFieldDefinitions: [] as FormFieldDefinition[],
  consentReason: null as string | null,
  consentStatus: 'pending' as ConsentStatus,
  _pendingCorrectionStep: null as string | null,
};

export const createConversationSlice: StateCreator<ConversationSlice> = (set, get) => ({
  ...initialConversationState,

  setPendingCorrectionStep: (step) => set({ _pendingCorrectionStep: step }),

  /* ══════════════════════════════════════════════════
   * goToWorkflowStep - THE single sync mechanism.
   *
   * Given a target step:
   *   - All steps BEFORE target → completed
   *   - Target step → current (not completed)
   *   - All steps AFTER target → cleared
   * ══════════════════════════════════════════════════ */
  goToWorkflowStep: (targetStep) => {
    const { selectedServiceId, serviceData } = get();
    const definition = getServiceDefinition(selectedServiceId);
    const stepOrder = definition
      ? definition.getSteps(serviceData).map(s => s.key)
      : GENERIC_STEP_KEYS;

    const targetIdx = stepOrder.indexOf(targetStep);

    if (targetIdx === -1) {
      // Step not in current order — just set it
      set({ isWorkflowOpen: true, workflowCurrentStep: targetStep });
      return;
    }

    const completed = stepOrder.slice(0, targetIdx);
    set({
      isWorkflowOpen: true,
      workflowCurrentStep: targetStep,
      workflowCompletedSteps: completed,
    });
  },

  /* ── Messages ── */

  addMessage: (role, content, audioTranscript = false) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      audioTranscript,
    };
    set(state => ({ messages: [...state.messages, message] }));
    return message.id;
  },

  removeMessage: (messageId) => {
    set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
  },

  updateMessageContent: (messageId, content) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, content } : m,
      ),
    }));
  },

  setCorrectionOnLastUserMessage: (correctedText) => {
    set(state => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user' && msgs[i].audioTranscript) {
          if (!shouldShowCorrection(msgs[i].content, correctedText)) break;
          msgs[i] = { ...msgs[i], correction: { text: correctedText, status: 'pending' } };
          break;
        }
      }
      return { messages: msgs };
    });
  },

  setCorrectionOnMessage: (messageId, correctedText) => {
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id === messageId && m.role === 'user' && m.audioTranscript) {
          if (!shouldShowCorrection(m.content, correctedText)) return m;
          return { ...m, correction: { text: correctedText, status: 'pending' as const } };
        }
        return m;
      }),
    }));
  },

  resolveCorrection: (messageId, accepted) => {
    set(state => {
      const status: 'accepted' | 'rejected' = accepted ? 'accepted' : 'rejected';
      const msgs = state.messages.map(m =>
        m.id === messageId && m.correction
          ? { ...m, correction: { ...m.correction, status } }
          : m
      );
      return { messages: msgs };
    });
  },

  clearMessages: () => set({ messages: [] }),

  /* ── Workflow helpers ── */

  openWorkflow: (step) =>
    set({ isWorkflowOpen: true, workflowCurrentStep: step, workflowCompletedSteps: [] }),

  closeWorkflow: () => set({ isWorkflowOpen: false }),

  /* ── Service selection ── */

  setSelectedService: (serviceId, serviceName) => {
    const definition = getServiceDefinition(serviceId);
    set({
      selectedServiceId: serviceId,
      formServiceName: serviceName,
      // Initialize serviceData with the definition's initial state
      ...(definition ? { serviceData: { ...definition.initialData } } : {}),
    });
  },

  /* ── Service data (generic) ── */

  setServiceData: (data) => set({ serviceData: data }),

  patchServiceData: (patch) => {
    set(state => ({ serviceData: { ...state.serviceData, ...patch } }));
  },

  /* ── Form (generic) ── */

  setCurrentForm: (form) => set({ currentForm: form }),

  updateFormField: (fieldId, value) => {
    const form = get().currentForm;
    if (!form) return;
    set({
      currentForm: {
        ...form,
        fields: { ...form.fields, [fieldId]: value },
        completedFields: form.completedFields.includes(fieldId)
          ? form.completedFields
          : [...form.completedFields, fieldId],
      },
    });
  },

  initializeForm: (serviceId, serviceName, fields) => {
    const emptyFields: Record<string, string> = {};
    for (const f of fields) {
      emptyFields[f.id] = '';
    }
    set({
      currentForm: {
        serviceId,
        fields: emptyFields,
        completedFields: [],
        currentFieldId: undefined,
        status: 'in_progress',
      },
      formFieldDefinitions: fields,
      formServiceName: serviceName,
    });
    get().goToWorkflowStep('fill');
  },

  setCurrentFormField: (fieldId) => {
    const form = get().currentForm;
    if (!form) return;
    set({ currentForm: { ...form, currentFieldId: fieldId } });
  },

  /* ── Consent ── */

  setConsentReason: (reason) => set({ consentReason: reason, consentStatus: 'pending' }),

  setConsentStatus: (status) => set({ consentStatus: status }),

  /* ── Reset ── */

  resetStepData: (fromStep) => {
    const { selectedServiceId, serviceData } = get();
    const definition = getServiceDefinition(selectedServiceId);

    const updates: Record<string, unknown> = {};

    // Service-specific reset
    if (definition) {
      const newData = definition.resetFromStep(fromStep, serviceData);
      updates.serviceData = newData;
    }

    // Shared reset: clear consent when verify step or later is being reset
    const steps = definition
      ? definition.getSteps(serviceData).map(s => s.key)
      : GENERIC_STEP_KEYS;
    const fromIdx = steps.indexOf(fromStep);
    const verifyIdx = steps.indexOf('verify');
    if (fromIdx >= 0 && verifyIdx >= 0 && fromIdx <= verifyIdx) {
      updates.consentReason = null;
      updates.consentStatus = 'pending';
    }

    if (Object.keys(updates).length > 0) {
      set(updates as unknown as Parameters<typeof set>[0]);
    }
  },

  resetWorkflow: () =>
    set({
      isWorkflowOpen: false,
      workflowCurrentStep: null,
      workflowCompletedSteps: [],
      selectedServiceId: null,
      formServiceName: null,
      serviceData: {},
      currentForm: null,
      formFieldDefinitions: [],
      consentReason: null,
      consentStatus: 'pending' as ConsentStatus,
    }),

  resetConversation: () => set({ ...initialConversationState }),
});
