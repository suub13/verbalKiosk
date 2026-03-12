/**
 * LanguageToggle - Switch between Korean and English.
 */

import { useStore } from '@/store';

export function LanguageToggle() {
  const language = useStore(s => s.language);
  const setLanguage = useStore(s => s.setLanguage);

  return (
    <button
      className="language-toggle"
      onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
      aria-label={language === 'ko' ? 'Switch to English' : '한국어로 전환'}
    >
      <span className={language === 'ko' ? 'language-toggle__active' : ''}>한</span>
      <span className="language-toggle__divider">/</span>
      <span className={language === 'en' ? 'language-toggle__active' : ''}>EN</span>
    </button>
  );
}
