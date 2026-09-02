'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { useRouter } from 'next/navigation';
import { NICK_MAX, NICK_MIN } from '@kingdc/contracts';
import { Avatar, Button, Field, Glass, Icon, Screen } from '@/ui';
import { errorMessage, updateNickname, uploadAvatar, validationMessage } from '@/lib/api';
import { useMe } from '@/features/auth/useMe';
import { useToast } from '@/features/shell/toast';
import { AvatarPicker } from './AvatarPicker';
import styles from './OnboardingForm.module.css';

export function OnboardingForm(): JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const { me, mutate } = useMe();
  const [nickname, setNickname] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [nickError, setNickError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Quem já tem nick não passa por aqui.
  useEffect(() => {
    if (me !== undefined && me.nickname !== null) router.replace('/app');
  }, [me, router]);

  const trimmed = nickname.trim();

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending || trimmed.length < NICK_MIN) return;

    setPending(true);
    try {
      let saved = await updateNickname(trimmed);
      if (file !== null) saved = await uploadAvatar(file);
      await mutate(saved, { revalidate: false });
      router.replace('/app');
    } catch (cause) {
      const fieldError = validationMessage(cause);
      if (fieldError === null) toast.show(errorMessage(cause));
      else setNickError(fieldError);
      setPending(false);
    }
  };

  return (
    <Screen eyebrow="PASSO 2 DE 2">
      <Glass variant="card" className={styles.card}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.intro}>
            <h1 className={styles.title}>Como você quer aparecer?</h1>
            <p className={styles.subtitle}>É isso que a galera vê quando você entra numa call.</p>
          </div>

          <AvatarPicker file={file} onPick={setFile} onError={(message) => toast.show(message)} />

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
            autoComplete="off"
            disabled={pending}
            autoFocus
          />

          <div className={styles.previewBlock}>
            <span className={styles.previewLabel}>Prévia na sala</span>
            <div className={styles.preview}>
              <Avatar
                userId={me?.id ?? 'preview'}
                nickname={trimmed}
                avatarUrl={me?.avatarUrl ?? null}
                size={30}
              />
              <span className={styles.previewName}>{trimmed.length > 0 ? trimmed : 'seu nick'}</span>
              <Icon name="mic" size={16} className={styles.previewIcon} />
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="submit" block disabled={pending || trimmed.length < NICK_MIN}>
              {pending ? 'Salvando…' : 'Entrar no King DC'}
            </Button>
            <p className={styles.hint}>Dá pra mudar depois em Configurações.</p>
          </div>
        </form>
      </Glass>
    </Screen>
  );
}
