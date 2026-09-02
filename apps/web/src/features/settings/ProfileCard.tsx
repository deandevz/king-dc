'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { NICK_MAX, NICK_MIN } from '@kingdc/contracts';
import { Button, Field, Glass, Icon, IconButton } from '@/ui';
import { deleteAvatar, errorMessage, updateNickname, uploadAvatar, validationMessage } from '@/lib/api';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { useApp } from '@/features/shell/AppContext';
import { useToast } from '@/features/shell/toast';
import styles from './cards.module.css';

/** Card "Meu perfil" (Settings.dc.html:70-118): foto, nick e o código de convite. */
export function ProfileCard(): JSX.Element {
  const { me, refreshMe } = useApp();
  const toast = useToast();
  const [nickname, setNickname] = useState(me.nickname);
  const [savedNickname, setSavedNickname] = useState(me.nickname);
  const [file, setFile] = useState<File | null>(null);
  const [nickError, setNickError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // O nick salvo mudou em outro lugar: o campo volta a refletir o servidor.
  if (savedNickname !== me.nickname) {
    setSavedNickname(me.nickname);
    setNickname(me.nickname);
  }

  const trimmed = nickname.trim();
  const dirty = trimmed !== me.nickname || file !== null;

  const save = async (): Promise<void> => {
    if (pending || !dirty || trimmed.length < NICK_MIN) return;
    setPending(true);
    try {
      if (trimmed !== me.nickname) await updateNickname(trimmed);
      if (file !== null) await uploadAvatar(file);
      setFile(null);
      await refreshMe();
      toast.show('Perfil salvo.');
    } catch (cause) {
      const fieldError = validationMessage(cause);
      if (fieldError === null) toast.show(errorMessage(cause));
      else setNickError(fieldError);
    } finally {
      setPending(false);
    }
  };

  const removePhoto = async (): Promise<void> => {
    setFile(null);
    if (me.avatarUrl === null) return;
    try {
      await deleteAvatar();
      await refreshMe();
    } catch (cause) {
      toast.show(errorMessage(cause));
    }
  };

  const copyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(me.code);
      toast.show('Código copiado.');
    } catch {
      toast.show('Não deu para copiar. Selecione o código na mão.');
    }
  };

  return (
    <Glass className={styles.card}>
      <span className={styles.cardLabel}>Meu perfil</span>

      <AvatarPicker
        file={file}
        onPick={setFile}
        onError={(message) => toast.show(message)}
        onClear={() => void removePhoto()}
        currentUrl={me.avatarUrl}
        size={80}
        buttonLabel="Trocar foto"
      />

      <Field
        label="Nick"
        value={nickname}
        onChange={(event) => {
          setNickname(event.target.value.slice(0, NICK_MAX));
          setNickError(null);
        }}
        counter={`${nickname.length} / ${NICK_MAX}`}
        maxLength={NICK_MAX}
        error={nickError ?? undefined}
        disabled={pending}
      />

      <div className={styles.codeBlock}>
        <span className={styles.codeLabel}>Código de convite</span>
        <div className={styles.codeRow}>
          <span className={styles.code}>{me.code}</span>
          <IconButton shape="square" label="Copiar código" onClick={() => void copyCode()}>
            <Icon name="copy" size={15} />
          </IconButton>
        </div>
      </div>

      <div className={styles.cardActions}>
        <Button
          compact
          onClick={() => void save()}
          disabled={pending || !dirty || trimmed.length < NICK_MIN}
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Glass>
  );
}
