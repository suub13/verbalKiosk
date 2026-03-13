/**
 * pipelineBridge — module-level singleton for pipeline ↔ UI communication.
 *
 * Replaces storing function references in Zustand state (anti-pattern).
 * Components call bridge methods; the pipeline registers handlers on connect.
 */

interface BridgeHandlers {
  sendFunctionResult: (callId: string, result: string) => void;
  sendOptionsConfirmed: (result: string) => void;
  onCorrectionRejected: () => void;
  disconnect: () => void;
  sendMicUnblock: () => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  unmuteMic: () => Promise<void>;
  muteMic: () => void;
}

type PartialHandlers = Partial<BridgeHandlers>;

let handlers: PartialHandlers = {};

export const pipelineBridge = {
  /** Called by useRealtimeAPI when a pipeline connects */
  register(newHandlers: PartialHandlers): void {
    handlers = { ...handlers, ...newHandlers };
  },

  /** Called by useRealtimeAPI cleanup / disconnect */
  clear(): void {
    handlers = {};
  },

  get sendFunctionResult(): ((callId: string, result: string) => void) | null {
    return handlers.sendFunctionResult ?? null;
  },

  get sendOptionsConfirmed(): ((result: string) => void) | null {
    return handlers.sendOptionsConfirmed ?? null;
  },

  get onCorrectionRejected(): (() => void) | null {
    return handlers.onCorrectionRejected ?? null;
  },

  get disconnect(): (() => void) | null {
    return handlers.disconnect ?? null;
  },

  get sendMicUnblock(): (() => void) | null {
    return handlers.sendMicUnblock ?? null;
  },

  get startStreaming(): (() => void) | null {
    return handlers.startStreaming ?? null;
  },

  get stopStreaming(): (() => void) | null {
    return handlers.stopStreaming ?? null;
  },

  get unmuteMic(): (() => Promise<void>) | null {
    return handlers.unmuteMic ?? null;
  },

  get muteMic(): (() => void) | null {
    return handlers.muteMic ?? null;
  },

};