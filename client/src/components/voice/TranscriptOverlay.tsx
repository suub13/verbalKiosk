/**
 * TranscriptOverlay - Semi-transparent overlay showing the real-time partial
 * transcript as it arrives from the STT engine.
 *
 * - Displays store.partialTranscript with a typing-cursor effect.
 * - Fades out when the transcript is cleared (empty string).
 * - Positioned absolutely at the bottom-center of its parent container.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';

/** Duration in ms for the fade-out animation after transcript clears. */
const FADE_OUT_MS = 600;

export const TranscriptOverlay: React.FC = () => {
  const partialTranscript = useStore(s => s.partialTranscript);

  /**
   * We keep a "display" copy so we can fade the previous text out gracefully
   * before hiding the element entirely.
   */
  const [displayText, setDisplayText] = useState('');
  const [visible, setVisible] = useState(false);

  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending fade timer when new text arrives.
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (partialTranscript) {
      setDisplayText(partialTranscript);
      setVisible(true);
    } else {
      // Start fade-out, then hide.
      setVisible(false);
      fadeTimerRef.current = setTimeout(() => {
        setDisplayText('');
      }, FADE_OUT_MS);
    }

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [partialTranscript]);

  // Nothing to render at all.
  if (!displayText) return null;

  return (
    <div
      className="transcript-overlay"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-label="음성 인식 텍스트"
      style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '85%',
        padding: '14px 28px',
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 22,
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.92)',
          fontWeight: 400,
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
        }}
      >
        {displayText}
        {/* Blinking cursor while actively receiving text */}
        {visible && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              animation: 'transcript-cursor-blink 800ms step-end infinite',
            }}
          />
        )}
      </p>

      {/*
        Inline keyframes for the blinking cursor.
        This avoids requiring a separate CSS file for a single animation.
      */}
      <style>{`
        @keyframes transcript-cursor-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
