import type { JSX } from 'react';
import { cx } from '@/ui';
import styles from './SpeakingBars.module.css';

/** Equalizador de 3 barras que o design usa ao lado do nome de quem está falando. */
export function SpeakingBars({ tall = false }: { tall?: boolean }): JSX.Element {
  return (
    <span className={cx(styles.bars, tall && styles.tall)} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
