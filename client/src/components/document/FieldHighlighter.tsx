/**
 * FieldHighlighter - Scrolls to and highlights the currently active field.
 */

import { useEffect } from 'react';
import { useStore } from '@/store';

export function FieldHighlighter() {
  const highlightedFieldId = useStore(s => s.highlightedFieldId);

  useEffect(() => {
    if (!highlightedFieldId) return;

    const el = document.getElementById(`field-${highlightedFieldId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedFieldId]);

  // This component only manages scroll behavior, no visual output
  return null;
}
