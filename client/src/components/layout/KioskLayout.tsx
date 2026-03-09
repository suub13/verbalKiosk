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
      <div className="kiosk-layout__header">
        <Header />
      </div>
      <main className="kiosk-layout__content">
        {children}
      </main>
      <div className="kiosk-layout__footer">
        <Footer />
      </div>
    </div>
  );
};
