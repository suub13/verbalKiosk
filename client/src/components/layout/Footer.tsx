/**
 * Footer component showing end session button.
 */

import React from 'react';
import { useStore } from '@/store';
import { useVoicePipeline } from '@/hooks/useVoicePipeline';

export const Footer: React.FC = () => {
  const sessionId = useStore(s => s.sessionId);
  const language = useStore(s => s.language);
  const { endSession } = useVoicePipeline();

  if (!sessionId) return null;

  return (
    <footer className="kiosk-footer">
      <div className="kiosk-footer__actions">
        <button className="kiosk-footer__end-btn" onClick={endSession}>
          {language === 'ko' ? '종료하기' : 'End Session'}
        </button>
      </div>
    </footer>
  );
};
