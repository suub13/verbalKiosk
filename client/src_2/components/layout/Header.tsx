/**
 * Header component matching Korean bank kiosk (우리은행) reference design.
 * Left: 우리은행 branding with circle icon. Right: Date + Time display.
 */

import React, { useState, useEffect } from 'react';

export const Header: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const day = String(currentTime.getDate()).padStart(2, '0');
  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');

  const formattedDate = `${year}.${month}.${day}`;
  const formattedTime = `${hours}:${minutes}`;

  return (
    <header className="kiosk-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Left: 우리은행 branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="17" fill="#1a5ab8" />
          <circle cx="18" cy="18" r="8" fill="#ffffff" />
        </svg>
        <span style={{ fontSize: '32px', fontWeight: 700, color: '#1a5ab8', letterSpacing: '-0.5px' }}>
          우리은행
        </span>
      </div>

      {/* Right: Date + Time */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
        <span style={{ fontSize: '22px', fontWeight: 400, color: '#4b5563' }}>
          {formattedDate}
        </span>
        <span style={{ fontSize: '26px', fontWeight: 700, color: '#1f2937' }}>
          {formattedTime}
        </span>
      </div>
    </header>
  );
};
