/**
 * Document slice - Manages document state for voice guide service.
 */

import type { StateCreator } from 'zustand';
import type { DocumentStructure, ReadingState, ReadingMode } from '@shared/types/document';

export interface DocumentSlice {
  document: DocumentStructure | null;
  readingState: ReadingState;
  highlightedFieldId: string | null;
  translations: Record<string, string>;
  isUploading: boolean;
  uploadError: string | null;

  setDocument: (doc: DocumentStructure | null) => void;
  setReadingMode: (mode: ReadingMode) => void;
  setReadingPlaying: (playing: boolean) => void;
  setReadingSpeed: (speed: number) => void;
  setCurrentFieldIndex: (index: number) => void;
  nextField: () => void;
  prevField: () => void;
  setHighlightedField: (fieldId: string | null) => void;
  setTranslations: (translations: Record<string, string>) => void;
  setUploading: (uploading: boolean) => void;
  setUploadError: (error: string | null) => void;
  resetDocument: () => void;
}

const initialReadingState: ReadingState = {
  mode: 'full',
  currentFieldIndex: 0,
  isPlaying: false,
  speed: 1.0,
  totalFields: 0,
};

export const createDocumentSlice: StateCreator<DocumentSlice> = (set, get) => ({
  document: null,
  readingState: initialReadingState,
  highlightedFieldId: null,
  translations: {},
  isUploading: false,
  uploadError: null,

  setDocument: (doc) =>
    set({
      document: doc,
      readingState: {
        ...initialReadingState,
        totalFields: doc?.fields.length ?? 0,
      },
    }),

  setReadingMode: (mode) =>
    set(state => ({
      readingState: { ...state.readingState, mode, currentFieldIndex: 0 },
    })),

  setReadingPlaying: (playing) =>
    set(state => ({
      readingState: { ...state.readingState, isPlaying: playing },
    })),

  setReadingSpeed: (speed) =>
    set(state => ({
      readingState: { ...state.readingState, speed: Math.max(0.5, Math.min(2.0, speed)) },
    })),

  setCurrentFieldIndex: (index) =>
    set(state => ({
      readingState: { ...state.readingState, currentFieldIndex: index },
      highlightedFieldId: state.document?.fields[index]?.id ?? null,
    })),

  nextField: () => {
    const { readingState, document } = get();
    if (!document) return;
    const next = Math.min(readingState.currentFieldIndex + 1, document.fields.length - 1);
    get().setCurrentFieldIndex(next);
  },

  prevField: () => {
    const { readingState } = get();
    const prev = Math.max(readingState.currentFieldIndex - 1, 0);
    get().setCurrentFieldIndex(prev);
  },

  setHighlightedField: (fieldId) => set({ highlightedFieldId: fieldId }),

  setTranslations: (translations) =>
    set(state => ({
      translations: { ...state.translations, ...translations },
    })),

  setUploading: (uploading) => set({ isUploading: uploading }),
  setUploadError: (error) => set({ uploadError: error }),

  resetDocument: () =>
    set({
      document: null,
      readingState: initialReadingState,
      highlightedFieldId: null,
      translations: {},
      isUploading: false,
      uploadError: null,
    }),
});
