/**
 * Root Zustand store combining all slices.
 */

import { create } from 'zustand';
import { createVoiceSlice, type VoiceSlice } from './slices/voiceSlice';
import { createConversationSlice, type ConversationSlice } from './slices/conversationSlice';
import { createDocumentSlice, type DocumentSlice } from './slices/documentSlice';

export type AppStore = VoiceSlice & ConversationSlice & DocumentSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createVoiceSlice(...a),
  ...createConversationSlice(...a),
  ...createDocumentSlice(...a),
}));
