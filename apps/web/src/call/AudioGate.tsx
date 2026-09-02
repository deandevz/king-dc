'use client';

import type { JSX } from 'react';
import { Button, Glass } from '@/ui';
import styles from './AudioGate.module.css';

/**
 * Browsers bloqueiam áudio sem interação. Sem este aviso, quem entra fica sem ouvir
 * ninguém e sem saber por quê (decisão D20).
 */
export function AudioGate({ onStart }: { onStart: () => Promise<void> }): JSX.Element {
  return (
    <div className={styles.overlay}>
      <Glass variant="card" className={styles.panel}>
        <span className={styles.title}>Clique para ativar o áudio</span>
        <span className={styles.hint}>
          O navegador bloqueou o som até você interagir com a página.
        </span>
        <Button pill onClick={() => void onStart()}>
          Ativar áudio
        </Button>
      </Glass>
    </div>
  );
}
