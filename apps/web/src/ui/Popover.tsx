'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import styles from './Popover.module.css';

export type PopoverProps = {
  /** Ponto do clique, em coordenadas da viewport. */
  x: number;
  y: number;
  label: string;
  onClose: () => void;
  children: ReactNode;
};

const MARGIN = 8;

/** Painel ancorado num ponto (menu de contexto). Fecha com ESC e clique fora. */
export function Popover({ x, y, label, onClose, children }: PopoverProps): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Mede o painel montado para não sair da viewport quando o clique é perto da borda.
  useLayoutEffect(() => {
    const rect = panel.current?.getBoundingClientRect();
    if (rect === undefined) return;
    setPosition({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - rect.width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - rect.height - MARGIN)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onMouseDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  const style: CSSProperties = { left: position.left, top: position.top };
  return (
    <div
      ref={panel}
      className={styles.panel}
      style={style}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
