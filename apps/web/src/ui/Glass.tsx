import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from './classes';
import styles from './Glass.module.css';

export type GlassProps = HTMLAttributes<HTMLDivElement> & {
  /** `card` é o painel flutuante do login e do onboarding. */
  variant?: 'plain' | 'card';
  children: ReactNode;
};

export function Glass({
  variant = 'plain',
  className,
  children,
  ...props
}: GlassProps): JSX.Element {
  return (
    <div className={cx(styles.glass, variant === 'card' && styles.card, className)} {...props}>
      {children}
    </div>
  );
}
