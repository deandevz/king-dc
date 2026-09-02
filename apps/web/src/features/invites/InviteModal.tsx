'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import type { CreateInviteResponse } from '@kingdc/contracts';
import { Button, Icon, Modal } from '@/ui';
import { createInvite, errorMessage } from '@/lib/api';
import { useToast } from '@/features/shell/toast';
import styles from './InviteModal.module.css';

export type InviteModalProps = {
  open: boolean;
  onClose: () => void;
};

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Convite é criado por admin e mostrado uma vez, com botão copiar (decisão D21). */
export function InviteModal({ open, onClose }: InviteModalProps): JSX.Element {
  const toast = useToast();
  const [invite, setInvite] = useState<CreateInviteResponse | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const [pending, setPending] = useState(false);

  // Cada abertura começa limpa: o código anterior já foi entregue a alguém.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setInvite(null);
  }

  const generate = async (): Promise<void> => {
    setPending(true);
    try {
      setInvite(await createInvite());
    } catch (cause) {
      toast.show(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const copy = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      toast.show('Código copiado.');
    } catch {
      toast.show('Não deu para copiar. Anote o código na mão.');
    }
  };

  return (
    <Modal open={open} title="Convidar alguém" onClose={onClose}>
      {invite === null ? (
        <div className={styles.empty}>
          <p className={styles.text}>
            Gere um código de 6 caracteres. Quem receber usa o código e escolhe a senha no
            primeiro login.
          </p>
          <Button onClick={() => void generate()} disabled={pending}>
            {pending ? 'Gerando…' : 'Gerar convite'}
          </Button>
        </div>
      ) : (
        <div className={styles.result}>
          <div className={styles.boxes} aria-label={`Código de convite ${invite.code}`}>
            {[...invite.code].map((char, index) => (
              <span key={index} className={styles.box}>
                {char}
              </span>
            ))}
          </div>
          <p className={styles.expiry}>Vale até {formatExpiry(invite.expiresAt)}.</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void copy(invite.code)}>
              <Icon name="copy" size={16} />
              Copiar código
            </Button>
            <Button onClick={onClose}>Pronto</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
