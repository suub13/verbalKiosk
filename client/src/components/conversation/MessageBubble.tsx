/**
 * MessageBubble - Chat bubble component for conversation messages.
 *
 * Visual styles by role:
 *  - user:      right-aligned, blue background
 *  - assistant: left-aligned, gray background
 *  - system:    centered, smaller, italic
 *
 * Shows a small "음성" badge when audioTranscript is true.
 * Shows correction UI when AI interpreted the user's speech differently.
 * Timestamp displayed in HH:MM format.
 */

import React from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  audioTranscript?: boolean;
  correction?: {
    text: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
  onResolveCorrection?: (accepted: boolean) => void;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/* ---------- inline style maps ---------- */

const containerStyles: Record<MessageBubbleProps['role'], React.CSSProperties> = {
  user: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    padding: '6px 20px',
  },
  assistant: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '6px 20px',
  },
  system: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 20px',
  },
};

const bubbleStyles: Record<MessageBubbleProps['role'], React.CSSProperties> = {
  user: {
    background: '#3b82f6',
    color: '#ffffff',
    borderRadius: '22px 22px 4px 22px',
    padding: '16px 24px',
    maxWidth: '75%',
    fontSize: 24,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  assistant: {
    background: '#e5e7eb',
    color: '#1f2937',
    borderRadius: '22px 22px 22px 4px',
    padding: '16px 24px',
    maxWidth: '75%',
    fontSize: 24,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  system: {
    background: 'transparent',
    color: '#6b7280',
    padding: '8px 16px',
    maxWidth: '85%',
    fontSize: 20,
    lineHeight: 1.4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
};

const timestampStyle: React.CSSProperties = {
  fontSize: 17,
  color: '#9ca3af',
  marginTop: 5,
  userSelect: 'none',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 15,
  color: '#6b7280',
  background: '#f3f4f6',
  borderRadius: 8,
  padding: '2px 8px',
  marginTop: 4,
  userSelect: 'none',
};

const micIconStyle: React.CSSProperties = {
  width: 13,
  height: 13,
};

const correctionDividerStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.25)',
  marginTop: 10,
  paddingTop: 10,
};

const correctionTextStyle: React.CSSProperties = {
  fontSize: 20,
  color: 'rgba(255,255,255,0.8)',
  lineHeight: 1.4,
};

const correctionButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 8,
  justifyContent: 'flex-end',
};

const pillButtonBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 22,
  padding: '6px 16px',
  fontSize: 18,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 48,
  minWidth: 48,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  transition: 'opacity 0.15s',
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  audioTranscript,
  correction,
  onResolveCorrection,
}) => {
  return (
    <div style={containerStyles[role]}>
      <div style={bubbleStyles[role]}>
        {content}

        {/* Correction UI for user bubbles */}
        {role === 'user' && correction && (
          <div style={correctionDividerStyle}>
            <div style={correctionTextStyle}>
              {correction.status === 'rejected' ? (
                <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                  {'→ '}{correction.text} ✗
                </span>
              ) : (
                <span>
                  {'→ '}{correction.text}
                  {correction.status === 'accepted' && ' ✓'}
                </span>
              )}
            </div>

            {correction.status === 'pending' && onResolveCorrection && (
              <div style={correctionButtonsStyle}>
                <button
                  style={{
                    ...pillButtonBase,
                    background: 'rgba(34,197,94,0.9)',
                    color: '#fff',
                  }}
                  onClick={() => onResolveCorrection(true)}
                >
                  ✓ 맞아요
                </button>
                <button
                  style={{
                    ...pillButtonBase,
                    background: 'rgba(239,68,68,0.9)',
                    color: '#fff',
                  }}
                  onClick={() => onResolveCorrection(false)}
                >
                  ✗ 아니요
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexDirection: role === 'user' ? 'row-reverse' : 'row',
        }}
      >
        <span style={timestampStyle}>{formatTime(timestamp)}</span>

        {audioTranscript && role !== 'system' && (
          <span style={badgeStyle}>
            <svg
              style={micIconStyle}
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 10a2 2 0 002-2V4a2 2 0 10-4 0v4a2 2 0 002 2zm4-2a4 4 0 01-3.5 3.97V14h2a.5.5 0 010 1h-5a.5.5 0 010-1h2v-2.03A4 4 0 014 8a.5.5 0 011 0 3 3 0 006 0 .5.5 0 011 0z" />
            </svg>
            음성
          </span>
        )}
      </div>
    </div>
  );
};
