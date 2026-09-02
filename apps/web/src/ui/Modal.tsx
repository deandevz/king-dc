'use client';

import { useEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { cx } from './classes';
import styles from './Modal.module.css';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** `lg` é o painel largo de configurações; `md` serve para confirmações. */
  size?: 'md' | 'lg';
  children: ReactNode;
};

const openModals: symbol[] = [];

/** Modal com ESC e clique no fundo para fechar (Settings é modal). */
export function Modal({ open, title, onClose, size = 'md', children }: ModalProps): JSX.Element | null {
  const panel = useRef<HTMLDivElement>(null);

  // `onClose` costuma ser uma arrow nova a cada render do pai (que re-renderiza a cada poll
  // de presença). Se o efeito dependesse dela, cada render refaria o foco no painel e
  // trocaria o "elemento anterior" pelo próprio painel: o foco pulava a cada polling e, ao
  // fechar, não voltava ao botão que abriu.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Pilha de modais abertos: ESC só fecha o de cima (confirmação antes do painel).
    const token = Symbol('modal');
    openModals.push(token);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === token) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    const previouslyFocused = document.activeElement;
    document.addEventListener('keydown', onKeyDown);
    panel.current?.focus();

    return () => {
      const index = openModals.indexOf(token);
      if (index >= 0) openModals.splice(index, 1);
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={cx(styles.panel, size === 'lg' && styles.wide)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <div className={styles.closeGroup}>
            <IconButton shape="square" label="Fechar" onClick={onClose}>
              <Icon name="close" size={18} />
            </IconButton>
            <span className={styles.escHint}>ESC</span>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
