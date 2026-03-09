/**
 * Service selector with two large gradient cards for choosing between
 * voice issuance guide (realtime) and document voice guide (cascaded).
 * Styled to match bank kiosk reference design.
 */

import React from 'react';
import { useStore } from '@/store';
import type { PipelineMode } from '@shared/types/voice';

interface ServiceSelectorProps {
  onSelect: (mode: PipelineMode) => void;
}

/* ---------- inline styles ---------- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 36px',
  minHeight: '100%',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 22,
  color: '#8892A4',
  marginBottom: 10,
  fontWeight: 400,
  letterSpacing: 0.2,
};

const titleStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 800,
  color: '#1B2A4A',
  marginBottom: 52,
  textAlign: 'center',
  lineHeight: 1.4,
};

const cardsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: 32,
  width: '100%',
  maxWidth: 1100,
};

const baseCardStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  minHeight: 340,
  borderRadius: 28,
  padding: '36px 36px 36px 36px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  cursor: 'pointer',
  border: 'none',
  overflow: 'hidden',
  textAlign: 'left',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const blueCardStyle: React.CSSProperties = {
  ...baseCardStyle,
  background: 'linear-gradient(135deg, #4A9BF5 0%, #2E6FD4 100%)',
};

const purpleCardStyle: React.CSSProperties = {
  ...baseCardStyle,
  background: 'linear-gradient(135deg, #8B7BF5 0%, #6C5BD4 100%)',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.95)',
  color: '#3A3A5C',
  fontSize: 18,
  fontWeight: 600,
  padding: '8px 18px',
  borderRadius: 24,
  marginBottom: 24,
  letterSpacing: 0.3,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 700,
  color: '#FFFFFF',
  lineHeight: 1.3,
  margin: 0,
  whiteSpace: 'pre-line',
  zIndex: 1,
};

const arrowCircleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 28,
  right: 28,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
};

const bgIconStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  right: 20,
  opacity: 0.15,
  pointerEvents: 'none',
  zIndex: 0,
};

/* ---------- SVG icon components ---------- */

const ArrowIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
    <path
      d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DocumentIcon: React.FC = () => (
  <svg width="100" height="100" viewBox="0 0 80 80" fill="none">
    <rect x="16" y="8" width="48" height="64" rx="6" stroke="#FFFFFF" strokeWidth="3" />
    <line x1="28" y1="26" x2="52" y2="26" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <line x1="28" y1="36" x2="52" y2="36" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <line x1="28" y1="46" x2="44" y2="46" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <path d="M46 54l4 4 8-8" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PrinterIcon: React.FC = () => (
  <svg width="100" height="100" viewBox="0 0 80 80" fill="none">
    <rect x="20" y="10" width="40" height="18" rx="3" stroke="#FFFFFF" strokeWidth="3" />
    <rect x="12" y="28" width="56" height="28" rx="5" stroke="#FFFFFF" strokeWidth="3" />
    <rect x="22" y="48" width="36" height="22" rx="3" stroke="#FFFFFF" strokeWidth="3" />
    <circle cx="52" cy="38" r="3" fill="#FFFFFF" />
    <line x1="30" y1="56" x2="50" y2="56" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="30" y1="62" x2="44" y2="62" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ---------- Component ---------- */

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({ onSelect }) => {
  const language = useStore(s => s.language);

  const handleSelect = (mode: PipelineMode) => {
    onSelect(mode);
  };

  return (
    <div style={containerStyle}>
      <p style={subtitleStyle}>
        {language === 'ko' ? '발급부터 출력까지 한 번에!' : 'Issuance to printing, all in one!'}
      </p>
      <h2 style={titleStyle}>
        {language === 'ko' ? '우리은행 문서 발급/출력' : 'Woori Bank Document Service'}
      </h2>

      <div style={cardsContainerStyle}>
        {/* Card 1 - Voice Issuance Guide (Realtime) */}
        <button
          style={blueCardStyle}
          onClick={() => handleSelect('realtime')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(46,111,212,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
          }}
        >
          {/* Arrow circle top-right */}
          <div style={arrowCircleStyle}>
            <ArrowIcon />
          </div>

          {/* Badge */}
          <span style={badgeStyle}>
            {language === 'ko' ? '우리은행 증명서 발급' : 'Woori Bank Certificates'}
          </span>

          {/* Title */}
          <h3 style={cardTitleStyle}>
            {language === 'ko' ? '음성 발급\n안내' : 'Voice Issuance\nGuide'}
          </h3>

          {/* Background icon */}
          <div style={bgIconStyle} aria-hidden="true">
            <DocumentIcon />
          </div>
        </button>

        {/* Card 2 - Document Voice Guide (Cascaded) */}
        <button
          style={purpleCardStyle}
          onClick={() => handleSelect('cascaded')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(108,91,212,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
          }}
        >
          {/* Arrow circle top-right */}
          <div style={arrowCircleStyle}>
            <ArrowIcon />
          </div>

          {/* Badge */}
          <span style={badgeStyle}>
            {language === 'ko' ? '내 문서 출력' : 'Print My Document'}
          </span>

          {/* Title */}
          <h3 style={cardTitleStyle}>
            {language === 'ko' ? '문서 음성\n안내' : 'Document Voice\nGuide'}
          </h3>

          {/* Background icon */}
          <div style={bgIconStyle} aria-hidden="true">
            <PrinterIcon />
          </div>
        </button>
      </div>
    </div>
  );
};
