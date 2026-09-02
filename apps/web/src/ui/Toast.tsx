import type { JSX } from 'react';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { cx } from './classes';
import styles from './Toast.module.css';

export type ToastProps = {
  message: string;
  tone?: 'info' | 'error';
  onDismiss?: () => void;
};

export function Toast({ message, tone = 'error', onDismiss }: ToastProps): JSX.Element {
  return (
    <div className={cx(styles.toast, tone === 'error' && styles.error)} role="status">
      <Icon name="info" size={18} className={styles.icon} />
      <span className={styles.message}>{message}</span>
      {onDismiss !== undefined ? (
        <IconButton shape="square" label="Fechar aviso" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}
