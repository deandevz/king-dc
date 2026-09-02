'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Icon, Modal } from '@/ui';
import { errorMessage, logout } from '@/lib/api';
import { useToast } from '@/features/shell/toast';
import { ProfileCard } from './ProfileCard';
import { AudioCard } from './AudioCard';
import styles from './SettingsModal.module.css';

export type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Configurações são um modal controlado por `?settings=1`. */
export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const signOut = async (): Promise<void> => {
    setLeaving(true);
    try {
      await logout();
      router.replace('/login');
    } catch (cause) {
      toast.show(errorMessage(cause));
      setLeaving(false);
    }
  };

  return (
    <>
      <Modal open={open} title="Configurações" size="lg" onClose={onClose}>
        <div className={styles.intro}>
          <h2 className={styles.title}>Perfil e áudio</h2>
          <p className={styles.subtitle}>
            Como você aparece pros outros e quais dispositivos o King DC usa.
          </p>
        </div>

        <div className={styles.grid}>
          <ProfileCard />
          <AudioCard />
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.signOut} onClick={() => setConfirming(true)}>
            <Icon name="leave" size={17} />
            Sair da conta
          </button>
        </div>
      </Modal>

      {/* Sair da conta pede confirmação; sair da call, não (decisão D18). */}
      <Modal open={confirming} title="Sair da conta" onClose={() => setConfirming(false)}>
        <p className={styles.confirmText}>
          Você vai precisar do código de convite e da senha para entrar de novo.
        </p>
        <div className={styles.confirmActions}>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={leaving}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void signOut()} disabled={leaving}>
            {leaving ? 'Saindo…' : 'Sair da conta'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
