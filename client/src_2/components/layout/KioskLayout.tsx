/**
 * Full-screen kiosk layout wrapper (1080x1920 portrait).
 * Contains Header at top, children in middle (flex-grow), Footer at bottom.
 */

import React from 'react';
import '@/styles/kiosk.css';
import { Header } from './Header';
import { Footer } from './Footer';

interface KioskLayoutProps {
  children: React.ReactNode;
}

export const KioskLayout: React.FC<KioskLayoutProps> = ({ children }) => {
  return (
    <div className="kiosk-layout">
      {/* <div className="kiosk-layout__header">
        <Header />
      </div> */}
      <main className="kiosk-layout__content">
        {children}
      </main>
      {/* <div className="kiosk-layout__footer">
        <Footer />
      </div> */}
      {/* Portal root — overflow:hidden 밖에서 마이크 버튼 렌더 */}
      <div id="mic-portal-root" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />
    </div>
  );
};