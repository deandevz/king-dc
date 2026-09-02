import type { JSX, ReactNode } from 'react';
import styles from './Screen.module.css';

export type ScreenProps = {
  /** Rótulo pequeno acima do card, tipo "PASSO 2 DE 2". */
  eyebrow?: string;
  footer?: ReactNode;
  children: ReactNode;
};

/** Tela centralizada com card de vidro: login e onboarding usam o mesmo enquadramento. */
export function Screen({ eyebrow, footer, children }: ScreenProps): JSX.Element {
  return (
    <main className={styles.screen}>
      {eyebrow !== undefined ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      {children}
      {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
    </main>
  );
}
