'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { Button, Icon } from '@/ui';
import { AVATAR_ACCEPT, AVATAR_LIMIT_LABEL, validateAvatar } from './avatarFile';
import styles from './AvatarPicker.module.css';

export type AvatarPickerProps = {
  file: File | null;
  onPick: (file: File) => void;
  onError: (message: string) => void;
  onClear?: () => void;
  /** Foto já salva, mostrada quando ainda não há arquivo novo escolhido. */
  currentUrl?: string | null;
  size?: number;
  buttonLabel?: string;
};

/** Input de arquivo escondido + prévia local via `URL.createObjectURL` (nada sobe sozinho). */
export function AvatarPicker({
  file,
  onPick,
  onError,
  onClear,
  currentUrl = null,
  size = 104,
  buttonLabel = 'Escolher arquivo',
}: AvatarPickerProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file === null ? null : URL.createObjectURL(file)), [file]);

  // A URL do blob vive enquanto o arquivo escolhido for o mesmo.
  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? currentUrl;

  return (
    <div className={styles.row}>
      <div
        className={shown === null ? styles.empty : styles.filled}
        style={{ width: size, height: size }}
      >
        {shown === null ? (
          <>
            <Icon name="camera" size={22} />
            <span className={styles.emptyLabel}>Foto</span>
          </>
        ) : (
          // Sem next/image: a prévia é um blob local e a foto salva vem pelo rewrite.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.photo} src={shown} alt="Prévia da foto de perfil" />
        )}
      </div>

      <div className={styles.actions}>
        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className={styles.input}
          aria-label="Foto de perfil"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (picked === undefined) return;
            const problem = validateAvatar(picked);
            if (problem !== null) {
              onError(problem);
              return;
            }
            onPick(picked);
          }}
        />
        <div className={styles.buttons}>
          <Button variant="secondary" compact onClick={() => input.current?.click()}>
            {buttonLabel}
          </Button>
          {onClear !== undefined && shown !== null ? (
            <Button variant="secondary" compact onClick={onClear}>
              Remover
            </Button>
          ) : null}
        </div>
        <span className={styles.limit}>{AVATAR_LIMIT_LABEL}</span>
      </div>
    </div>
  );
}
