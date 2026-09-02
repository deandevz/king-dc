'use client';

import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { useRouter } from 'next/navigation';
import { CODE_LENGTH, PASSWORD_MIN } from '@kingdc/contracts';
import { Button, CodeInput, Field, Glass, Icon, Screen } from '@/ui';
import { ApiError, login } from '@/lib/api';
import styles from './LoginForm.module.css';

/** Mensagens por código de erro da API; o resto cai na mensagem do servidor. */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Sem conexão com o servidor. Tente de novo.';
  if (error.code === 'INVALID_CREDENTIALS') return 'Código ou senha incorretos.';
  if (error.code === 'INVITE_EXPIRED') return 'Esse convite já foi usado ou expirou. Peça outro.';
  if (error.code === 'RATE_LIMITED') return 'Muitas tentativas. Espere um minuto e tente de novo.';
  return error.message;
}

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending) return;
    if (password.length < PASSWORD_MIN) {
      setError(`A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const me = await login({ code, password });
      router.replace(me.nickname === null ? '/onboarding' : '/app');
    } catch (cause) {
      setError(messageFor(cause));
      setPending(false);
    }
  };

  return (
    <Screen footer="King DC · servidor privado">
      <div className={styles.brand}>
        <Icon name="brand" size={26} className={styles.brandMark} />
        <span className={styles.brandName}>King DC</span>
      </div>

      <Glass variant="card" className={styles.card}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.intro}>
            <h1 className={styles.title}>Entrar no servidor</h1>
            <p className={styles.subtitle}>Digite o código de convite que você recebeu.</p>
          </div>

          <CodeInput value={code} onChange={setCode} disabled={pending} autoFocus />

          <Field
            label="Senha"
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            icon={<Icon name="lock" size={18} className={styles.fieldIcon} />}
            autoComplete="current-password"
            disabled={pending}
          />

          {error !== null ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button type="submit" block disabled={pending || code.length < CODE_LENGTH}>
              {pending ? 'Entrando…' : 'Entrar'}
            </Button>
            <p className={styles.hint}>Convites são gerados pelo admin do servidor.</p>
          </div>
        </form>
      </Glass>
    </Screen>
  );
}
