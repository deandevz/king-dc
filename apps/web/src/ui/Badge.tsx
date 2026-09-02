import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from './classes';
import styles from './Badge.module.css';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** Bolinha de 6px à esquerda, como em "CONECTADO". */
  dot?: boolean;
  children: ReactNode;
};

/** Pílula em accent, a única que o app usa ("CONECTADO" no header do canal). */
export function Badge({ dot = false, className, children, ...props }: BadgeProps): JSX.Element {
  return (
    <span className={cx(styles.badge, className)} {...props}>
      {dot ? <span className={styles.dot} /> : null}
      {children}
    </span>
  );
}
