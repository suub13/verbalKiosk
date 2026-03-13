/**
 * Root Zustand store combining all slices.
 */

import { create } from 'zustand';
import { createVoiceSlice, type VoiceSlice } from './slices/voiceSlice';
import { createConversationSlice, type ConversationSlice } from './slices/conversationSlice';

export type AppStore = VoiceSlice & ConversationSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createVoiceSlice(...a),
  ...createConversationSlice(...a),
}));
