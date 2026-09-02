'use client';

import type { JSX } from 'react';
import { Icon, IconButton, cx } from '@/ui';
import styles from './ControlBar.module.css';

export type ControlBarProps = {
  micEnabled: boolean;
  deafened: boolean;
  sharing: boolean;
  /** Em push-to-talk o botão de mic vira indicador com a dica da tecla, já legível (D12). */
  pttHint: string | null;
  onToggleMic: () => void;
  onToggleDeaf: () => void;
  onToggleShare: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
};

/** Pílula flutuante a 34 px do fundo, 4 botões de 46 px + separador + "Sair". */
export function ControlBar({
  micEnabled,
  deafened,
  sharing,
  pttHint,
  onToggleMic,
  onToggleDeaf,
  onToggleShare,
  onOpenSettings,
  onLeave,
}: ControlBarProps): JSX.Element {
  const micLabel =
    pttHint !== null
      ? `Microfone: segure ${pttHint} para falar`
      : micEnabled
        ? 'Desligar o microfone'
        : 'Ligar o microfone';

  return (
    <div className={styles.bar}>
      <IconButton
        label={micLabel}
        tone={micEnabled ? 'active' : 'neutral'}
        onClick={onToggleMic}
        aria-pressed={micEnabled}
        data-testid="control-mic"
      >
        <Icon name={micEnabled ? 'mic' : 'micOff'} size={19} />
      </IconButton>
      <IconButton
        label={deafened ? 'Voltar a ouvir' : 'Ensurdecer'}
        tone={deafened ? 'danger' : 'neutral'}
        onClick={onToggleDeaf}
        aria-pressed={deafened}
        data-testid="control-deaf"
      >
        <Icon name={deafened ? 'headphonesOff' : 'headphones'} size={19} />
      </IconButton>
      <IconButton
        label={sharing ? 'Parar de compartilhar a tela' : 'Compartilhar a tela'}
        tone={sharing ? 'active' : 'neutral'}
        onClick={onToggleShare}
        aria-pressed={sharing}
        data-testid="control-share"
      >
        <Icon name="share" size={19} />
      </IconButton>
      <IconButton label="Configurações" onClick={onOpenSettings} data-testid="control-settings">
        <Icon name="settings" size={19} />
      </IconButton>

      <span className={styles.divider} />

      <button type="button" className={styles.leave} onClick={onLeave} data-testid="control-leave">
        <Icon name="leave" size={19} />
        <span>Sair</span>
      </button>

      {pttHint === null ? null : (
        <span className={cx(styles.hint, micEnabled && styles.hintLive)}>
          segure <kbd className={styles.key}>{pttHint}</kbd>
        </span>
      )}
    </div>
  );
}
