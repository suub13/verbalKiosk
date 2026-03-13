// /**
//  * Voice state machine slice for Zustand store.
//  * Manages: IDLE → LISTENING → PROCESSING → SPEAKING → IDLE
//  * Supports barge-in (SPEAKING → LISTENING) and error recovery.
//  */

// import type { StateCreator } from 'zustand';
// import type { VoiceState, AudioLevelData, PipelineMode, SupportedLanguage } from '@shared/types/voice';
// import { VOICE_TRANSITIONS } from '@shared/types/voice';
// import { TIMINGS } from '@/constants/timings';

// export interface VoiceSlice {
//   // State
//   voiceState: VoiceState;
//   previousState: VoiceState;
//   pipelineMode: PipelineMode;
//   language: SupportedLanguage;
//   audioLevel: AudioLevelData;
//   isMuted: boolean;
//   errorMessage: string | null;
//   errorCount: number;

//   // Partial transcript (real-time display)
//   partialTranscript: string;
//   isBargeIn: boolean;

//   // Session
//   sessionId: string | null;
//   sessionExpiresAt: number | null;

//   // Phone verification
//   phoneNumber: string | null;
//   phoneVerified: boolean;
//   privacyConsented: boolean;

//   // Actions
//   transition: (to: VoiceState) => boolean;
//   setAudioLevel: (level: AudioLevelData) => void;
//   setMuted: (muted: boolean) => void;
//   setLanguage: (lang: SupportedLanguage) => void;
//   setPipelineMode: (mode: PipelineMode) => void;
//   setPartialTranscript: (text: string) => void;
//   setSession: (id: string, expiresAt: number) => void;
//   clearSession: () => void;
//   setError: (message: string) => void;
//   clearError: () => void;
//   setPhoneNumber: (phone: string | null) => void;
//   setPhoneVerified: (verified: boolean) => void;
//   setPrivacyConsented: (consented: boolean) => void;
//   reset: () => void;
// }

// const initialState = {
//   voiceState: 'idle' as VoiceState,
//   previousState: 'idle' as VoiceState,
//   pipelineMode: 'realtime' as PipelineMode,
//   language: 'ko' as SupportedLanguage,
//   audioLevel: { rms: 0, peak: 0, timestamp: 0 },
//   isMuted: false,
//   errorMessage: null,
//   errorCount: 0,
//   partialTranscript: '',
//   isBargeIn: false,
//   sessionId: null,
//   sessionExpiresAt: null,
//   phoneNumber: null as string | null,
//   phoneVerified: false,
//   privacyConsented: false,
// };

// export const createVoiceSlice: StateCreator<VoiceSlice> = (set, get) => ({
//   ...initialState,

//   transition: (to: VoiceState) => {
//     const current = get().voiceState;
//     const allowed = VOICE_TRANSITIONS[current];

//     if (!allowed.includes(to)) {
//       console.warn(`[VoiceSlice] Invalid transition: ${current} → ${to}`);
//       return false;
//     }

//     const isBargeIn = current === 'speaking' && to === 'listening';

//     set({
//       voiceState: to,
//       previousState: current,
//       isBargeIn,
//       // Clear partial transcript on new listening phase
//       ...(to === 'listening' ? { partialTranscript: '' } : {}),
//       // Clear error on recovery
//       ...(current === 'error' && to === 'idle' ? { errorMessage: null } : {}),
//     });

//     return true;
//   },

//   setAudioLevel: (level: AudioLevelData) => {
//     // High-frequency update - minimal state change
//     set({ audioLevel: level });
//   },

//   setMuted: (muted: boolean) => set({ isMuted: muted }),

//   setLanguage: (lang: SupportedLanguage) => set({ language: lang }),

//   setPipelineMode: (mode: PipelineMode) => set({ pipelineMode: mode }),

//   setPartialTranscript: (text: string) => set({ partialTranscript: text }),

//   setSession: (id: string, expiresAt: number) =>
//     set({ sessionId: id, sessionExpiresAt: expiresAt }),

//   clearSession: () =>
//     set({ sessionId: null, sessionExpiresAt: null, phoneNumber: null, phoneVerified: false, privacyConsented: false }),

//   setError: (message: string) => {
//     const state = get();
//     const newErrorCount = state.errorCount + 1;

//     set({
//       voiceState: 'error',
//       previousState: state.voiceState,
//       errorMessage: message,
//       errorCount: newErrorCount,
//     });

//     // Auto-recover after threshold if under error count limit
//     if (newErrorCount < 5) {
//       setTimeout(() => {
//         if (get().voiceState === 'error') {
//           get().clearError();
//         }
//       }, TIMINGS.ERROR_AUTO_RECOVER_MS);
//     }
//   },

//   clearError: () => {
//     set({
//       voiceState: 'idle',
//       errorMessage: null,
//     });
//   },

//   setPhoneNumber: (phone: string | null) => set({ phoneNumber: phone }),

//   setPhoneVerified: (verified: boolean) => set({ phoneVerified: verified }),

//   setPrivacyConsented: (consented: boolean) => set({ privacyConsented: consented }),

//   reset: () => set(initialState),
// });


/**
 * Voice state machine slice for Zustand store.
 * Manages: IDLE → LISTENING → PROCESSING → SPEAKING → IDLE
 * Supports barge-in (SPEAKING → LISTENING) and error recovery.
 */

import type { StateCreator } from 'zustand';
import type { VoiceState, AudioLevelData, PipelineMode, SupportedLanguage } from '@shared/types/voice';
import { VOICE_TRANSITIONS } from '@shared/types/voice';
import { TIMINGS } from '@/constants/timings';

export interface VoiceSlice {
  // State
  voiceState: VoiceState;
  previousState: VoiceState;
  pipelineMode: PipelineMode;
  language: SupportedLanguage;
  audioLevel: AudioLevelData;
  isMuted: boolean;
  errorMessage: string | null;
  errorCount: number;

  // Partial transcript (real-time display)
  partialTranscript: string;
  aiPartialTranscript: string;   // AI 발화 스트리밍 오버레이용 (즉시 업데이트)
  isBargeIn: boolean;

  // Session
  sessionId: string | null;
  sessionExpiresAt: number | null;

  // Phone verification
  phoneNumber: string | null;
  phoneVerified: boolean;
  privacyConsented: boolean;

  // Actions
  transition: (to: VoiceState) => boolean;
  setAudioLevel: (level: AudioLevelData) => void;
  setMuted: (muted: boolean) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  setPipelineMode: (mode: PipelineMode) => void;
  setPartialTranscript: (text: string) => void;
  setAiPartialTranscript: (text: string) => void;
  setSession: (id: string, expiresAt: number) => void;
  clearSession: () => void;
  setError: (message: string) => void;
  clearError: () => void;
  setPhoneNumber: (phone: string | null) => void;
  setPhoneVerified: (verified: boolean) => void;
  setPrivacyConsented: (consented: boolean) => void;
  reset: () => void;
}

const initialState = {
  voiceState: 'idle' as VoiceState,
  previousState: 'idle' as VoiceState,
  pipelineMode: 'realtime' as PipelineMode,
  language: 'ko' as SupportedLanguage,
  audioLevel: { rms: 0, peak: 0, timestamp: 0 },
  isMuted: false,
  errorMessage: null,
  errorCount: 0,
  partialTranscript: '',
  aiPartialTranscript: '',
  isBargeIn: false,
  sessionId: null,
  sessionExpiresAt: null,
  phoneNumber: null as string | null,
  phoneVerified: false,
  privacyConsented: false,
};

export const createVoiceSlice: StateCreator<VoiceSlice> = (set, get) => ({
  ...initialState,

  transition: (to: VoiceState) => {
    const current = get().voiceState;
    const allowed = VOICE_TRANSITIONS[current];

    if (!allowed.includes(to)) {
      console.warn(`[VoiceSlice] Invalid transition: ${current} → ${to}`);
      return false;
    }

    const isBargeIn = current === 'speaking' && to === 'listening';

    set({
      voiceState: to,
      previousState: current,
      isBargeIn,
      // Clear partial transcript on new listening phase
      ...(to === 'listening' ? { partialTranscript: '', aiPartialTranscript: '' } : {}),
      // Clear error on recovery
      ...(current === 'error' && to === 'idle' ? { errorMessage: null } : {}),
    });

    return true;
  },

  setAudioLevel: (level: AudioLevelData) => {
    // High-frequency update - minimal state change
    set({ audioLevel: level });
  },

  setMuted: (muted: boolean) => set({ isMuted: muted }),

  setLanguage: (lang: SupportedLanguage) => set({ language: lang }),

  setPipelineMode: (mode: PipelineMode) => set({ pipelineMode: mode }),

  setPartialTranscript: (text: string) => set({ partialTranscript: text }),

  setAiPartialTranscript: (text: string) => set({ aiPartialTranscript: text }),

  setSession: (id: string, expiresAt: number) =>
    set({ sessionId: id, sessionExpiresAt: expiresAt }),

  clearSession: () =>
    set({ sessionId: null, sessionExpiresAt: null, phoneNumber: null, phoneVerified: false, privacyConsented: false }),

  setError: (message: string) => {
    const state = get();
    const newErrorCount = state.errorCount + 1;

    set({
      voiceState: 'error',
      previousState: state.voiceState,
      errorMessage: message,
      errorCount: newErrorCount,
    });

    // Auto-recover after threshold if under error count limit
    if (newErrorCount < 5) {
      setTimeout(() => {
        if (get().voiceState === 'error') {
          get().clearError();
        }
      }, TIMINGS.ERROR_AUTO_RECOVER_MS);
    }
  },

  clearError: () => {
    set({
      voiceState: 'idle',
      errorMessage: null,
    });
  },

  setPhoneNumber: (phone: string | null) => set({ phoneNumber: phone }),

  setPhoneVerified: (verified: boolean) => set({ phoneVerified: verified }),

  setPrivacyConsented: (consented: boolean) => set({ privacyConsented: consented }),

  reset: () => set(initialState),
});