/**
 * VoiceStateIndicator - Circular animated indicator showing current voice state.
 *
 * Visual modes:
 *  - IDLE:       Static circle, muted colors, "대기 중"
 *  - LISTENING:  Pulsing circle with audio-level visualization, "듣고 있어요"
 *  - PROCESSING: Spinning dots animation, "처리 중..."
 *  - SPEAKING:   Expanding/contracting ripple effect, "말하고 있어요"
 *  - ERROR:      Red pulse with error icon, shows errorMessage
 *
 * Reads voiceState and audioLevel from the Zustand store.
 * 260px diameter for kiosk visibility.
 */

import React, { useMemo } from 'react';
import { useStore } from '@/store';
import type { VoiceState } from '@shared/types/voice';

/* ---------- constants ---------- */
const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 104;
const DOT_COUNT = 8;
const RIPPLE_COUNT = 3;

/* ---------- per-state label / colors ---------- */
const STATE_META: Record<VoiceState, { label: string; color: string }> = {
  idle:       { label: '대기 중',       color: '#94a3b8' },
  listening:  { label: '듣고 있어요',   color: '#3b82f6' },
  processing: { label: '처리 중...',    color: '#a855f7' },
  speaking:   { label: '말하고 있어요', color: '#22c55e' },
  error:      { label: '오류',          color: '#ef4444' },
};

/* ---------- component ---------- */
export const VoiceStateIndicator: React.FC = () => {
  const voiceState   = useStore(s => s.voiceState);
  const audioLevel   = useStore(s => s.audioLevel);
  const errorMessage = useStore(s => s.errorMessage);

  const { label, color } = STATE_META[voiceState];

  /* Scale the listening ring based on RMS (0-1). */
  const rmsScale = useMemo(
    () => 1 + audioLevel.rms * 0.35,
    [audioLevel.rms],
  );

  return (
    <div
      className={`voice-indicator voice-indicator--${voiceState}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        {/* ----- IDLE: static ring ----- */}
        {voiceState === 'idle' && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={4}
            opacity={0.5}
          />
        )}

        {/* ----- LISTENING: pulsing ring scaled by RMS ----- */}
        {voiceState === 'listening' && (
          <>
            {/* Outer glow driven by audio level */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={3}
              opacity={0.25}
              style={{
                transform: `scale(${rmsScale})`,
                transformOrigin: 'center',
                transition: 'transform 80ms linear',
              }}
            />
            {/* Inner solid ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS * 0.85}
              fill="none"
              stroke={color}
              strokeWidth={4}
              opacity={0.7}
              style={{
                transform: `scale(${1 + audioLevel.rms * 0.15})`,
                transformOrigin: 'center',
                transition: 'transform 80ms linear',
              }}
            />
            {/* Audio bars around circumference */}
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
              const barLength = 6 + audioLevel.rms * 16 * (0.6 + 0.4 * Math.sin(i * 1.7));
              const x1 = CENTER + Math.cos(angle) * (RADIUS * 0.85 + 6);
              const y1 = CENTER + Math.sin(angle) * (RADIUS * 0.85 + 6);
              const x2 = CENTER + Math.cos(angle) * (RADIUS * 0.85 + 6 + barLength);
              const y2 = CENTER + Math.sin(angle) * (RADIUS * 0.85 + 6 + barLength);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  opacity={0.6 + audioLevel.rms * 0.4}
                  style={{ transition: 'all 80ms linear' }}
                />
              );
            })}
          </>
        )}

        {/* ----- PROCESSING: spinning dots ----- */}
        {voiceState === 'processing' && (
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${CENTER} ${CENTER}`}
              to={`360 ${CENTER} ${CENTER}`}
              dur="1.2s"
              repeatCount="indefinite"
            />
            {Array.from({ length: DOT_COUNT }).map((_, i) => {
              const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
              const dotOpacity = 0.25 + (i / DOT_COUNT) * 0.75;
              const dotR = 4 + (i / DOT_COUNT) * 3;
              return (
                <circle
                  key={i}
                  cx={CENTER + Math.cos(angle) * RADIUS}
                  cy={CENTER + Math.sin(angle) * RADIUS}
                  r={dotR}
                  fill={color}
                  opacity={dotOpacity}
                />
              );
            })}
          </g>
        )}

        {/* ----- SPEAKING: expanding / contracting ripples ----- */}
        {voiceState === 'speaking' && (
          <>
            {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
              <circle
                key={i}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                opacity={0}
              >
                <animate
                  attributeName="r"
                  from={String(RADIUS * 0.6)}
                  to={String(RADIUS * 1.15)}
                  dur="1.8s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.7"
                  to="0"
                  dur="1.8s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
            {/* Steady inner ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS * 0.55}
              fill="none"
              stroke={color}
              strokeWidth={3}
              opacity={0.8}
            />
          </>
        )}

        {/* ----- ERROR: red pulsing ring + icon ----- */}
        {voiceState === 'error' && (
          <>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={4}
              opacity={0.8}
            >
              <animate
                attributeName="stroke-width"
                values="4;8;4"
                dur="1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.8;0.4;0.8"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Exclamation mark icon */}
            <text
              x={CENTER}
              y={CENTER - 8}
              textAnchor="middle"
              dominantBaseline="central"
              fill={color}
              fontSize={60}
              fontWeight="bold"
              aria-hidden="true"
            >
              !
            </text>
          </>
        )}
      </svg>

      {/* ----- Label text below the indicator ----- */}
      <span
        style={{
          position: 'absolute',
          bottom: -44,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: 24,
          fontWeight: 600,
          color,
          transition: 'color 300ms ease',
          userSelect: 'none',
        }}
      >
        {voiceState === 'error' && errorMessage ? errorMessage : label}
      </span>
    </div>
  );
};
