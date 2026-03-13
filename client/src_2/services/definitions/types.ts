/**
 * ClientServiceDefinition — plugin interface for document service types.
 *
 * Each document service (주민등록등본, 건강보험, 납세증명서, …) implements this interface.
 * Core infrastructure (WorkflowPanel, dispatcher, conversationSlice) only knows this interface,
 * not any specific service — satisfying the Open-Closed Principle.
 */

import type React from 'react';

export interface StepDef {
  key: string;
  label: string;
}

export interface DispatchContext {
  sendResult: (callId: string, data: Record<string, unknown>) => void;
  setCorrectionStep: (step: string | null) => void;
  setPendingCorrection: (corrected: string) => void;
  addMessage: (role: 'user' | 'assistant' | 'system', content: string, audioTranscript?: boolean) => string;
}

export type FunctionHandler = (
  callId: string,
  args: string,
  ctx: DispatchContext,
) => void;

export interface ClientServiceDefinition {
  id: string;
  name: string;

  /** Dynamic step list — may omit steps based on current service data (e.g. no 'options' for basic issuance) */
  getSteps(serviceData: Record<string, unknown>): StepDef[];

  /**
   * Render a step's detail content.
   * Return null to fall back to the generic renderer in WorkflowPanel.
   */
  renderStep(step: string, serviceData: Record<string, unknown>): React.ReactNode | null;

  /** Initial service data state when service is first selected */
  initialData: Record<string, unknown>;

  /**
   * Reset service data from a given step onward.
   * Returns a new (shallow-cloned) serviceData object with the relevant fields cleared.
   */
  resetFromStep(step: string, data: Record<string, unknown>): Record<string, unknown>;

  /** Service-specific function call handlers (keyed by function name) */
  functionHandlers?: Partial<Record<string, FunctionHandler>>;

  /** Human-readable correction bubble labels for each step key (used when navigating backward) */
  stepLabels?: Record<string, string>;

  /**
   * Correction rollback handlers (keyed by correction context step).
   * Called when the user rejects a speech recognition result.
   */
  correctionRollback?: Record<string, (
    patchServiceData: (patch: Partial<Record<string, unknown>>) => void,
    goToWorkflowStep: (step: string) => void,
    serviceData: Record<string, unknown>,
  ) => void>;
}
