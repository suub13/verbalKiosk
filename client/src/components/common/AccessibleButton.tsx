/**
 * AccessibleButton - Large, high-contrast button for kiosk touchscreen.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
}

export function AccessibleButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      className={`accessible-btn accessible-btn--${variant} accessible-btn--${size} ${className}`}
      {...props}
    >
      {icon && <span className="accessible-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="accessible-btn__label">{children}</span>
    </button>
  );
}
