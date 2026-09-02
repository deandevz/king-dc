'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PresenceParticipant } from '@kingdc/contracts';
import { micEnabledForMode } from '@/call';
import type { CallConnectionState } from '@/call';
import { useMe } from '@/features/auth/useMe';
import { useChannels } from '@/features/channels/useChannels';
import { applyPresenceOverlay, pollingListsUser } from '@/features/channels/presenceOverlay';
import { Sidebar } from '@/features/channels/Sidebar';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { useAudioPrefs } from '@/features/settings/useAudioPrefs';
import { InviteModal } from '@/features/invites/InviteModal';
import { ToastProvider, useToast } from './toast';
import { AppContextProvider } from './AppContext';
import type { AppState } from './AppContext';
import styles from './AppShell.module.css';

/** Tela de espera enquanto o shell não hidrata nem sabe quem está logado. */
export function AppBooting(): JSX.Element {
  return (
    <main className={styles.booting} aria-busy="true">
      <span className={styles.bootingText}>Carregando…</span>
    </main>
  );
}

/** Layout de duas colunas do app. Dono da sessão, da presença e dos modais. */
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ToastProvider>
      <AppShellInner>{children}</AppShellInner>
    </ToastProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const { me, error: meError, mutate } = useMe();
  const { data, error: channelsError, loading } = useChannels();
  const { prefs, update } = useAudioPrefs();

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [connection, setConnection] = useState<CallConnectionState>('disconnected');
  const [inviteOpen, setInviteOpen] = useState(false);
  // Lista da sala do LiveKit do canal conectado, e a saída otimista enquanto o polling
  // ainda me devolve no canal de onde saí.
  const [live, setLive] = useState<{ slug: string; participants: PresenceParticipant[] } | null>(null);
  const [hideSelf, setHideSelf] = useState(false);

  const settingsOpen = searchParams.get('settings') === '1';

  // Sessão inválida ou perfil incompleto: o resto do app não faz sentido sem isso.
  useEffect(() => {
    if (meError?.status === 401) router.replace('/login');
  }, [meError, router]);

  useEffect(() => {
    if (me !== undefined && me.nickname === null) router.replace('/onboarding');
  }, [me, router]);

  // API fora do ar: um toast só por queda (o polling de 2 s traria um novo a cada erro) e a
  // sidebar marca a presença como velha, o mesmo aviso do X-Presence-Stale. 401 aqui é a
  // sessão morta depois do /me ter carregado: volta para o login.
  const outageRef = useRef(false);
  useEffect(() => {
    if (channelsError === undefined) {
      outageRef.current = false;
      return;
    }
    if (channelsError.status === 401) {
      router.replace('/login');
      return;
    }
    if (outageRef.current) return;
    outageRef.current = true;
    toast.show(channelsError.message);
  }, [channelsError, router, toast]);

  const openSettings = useCallback(() => {
    router.push(`${pathname}?settings=1`, { scroll: false });
  }, [pathname, router]);

  const closeSettings = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  const selectChannel = useCallback(
    (slug: string) => {
      // Trocar de canal durante a call: sai do atual e entra no novo. O estado
      // volta para "conectando" junto, senão o badge e o dock anunciam o canal novo como
      // conectado enquanto quem está no ar ainda é a sala antiga.
      if (activeSlug !== null && activeSlug !== slug) {
        setActiveSlug(slug);
        setConnection('connecting');
        setLive(null);
      }
      router.push(`/app/c/${slug}`);
    },
    [activeSlug, router],
  );

  const join = useCallback((slug: string) => {
    setConnection('connecting');
    setActiveSlug(slug);
    setLive(null);
    setHideSelf(false);
  }, []);

  const leave = useCallback(() => {
    setActiveSlug(null);
    setConnection('disconnected');
    setLive(null);
    setHideSelf(true);
  }, []);

  const reportParticipants = useCallback(
    (slug: string, participants: PresenceParticipant[]) => {
      setLive({ slug, participants });
    },
    [],
  );

  // A saída otimista vale só até o `GET /channels` concordar que eu não estou mais lá.
  // Ajuste no próprio render (o mesmo padrão do card de perfil): um efeito aqui só geraria
  // um render a mais para chegar ao mesmo valor.
  if (hideSelf && me !== undefined && data !== undefined && !pollingListsUser(data.channels, me.id)) {
    setHideSelf(false);
  }

  const refreshMe = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const presence = useMemo(() => {
    if (me === undefined || me.nickname === null) return null;
    const self: PresenceParticipant = {
      userId: me.id,
      nickname: me.nickname,
      avatarUrl: me.avatarUrl,
      micMuted: !micEnabledForMode(prefs.inputMode),
      deafened: false,
      screenSharing: false,
    };
    return applyPresenceOverlay(data?.channels ?? [], {
      activeSlug,
      live: live !== null && live.slug === activeSlug ? live.participants : null,
      self,
      hideSelf,
    });
  }, [me, data, activeSlug, live, hideSelf, prefs.inputMode]);

  const state = useMemo<AppState | null>(() => {
    if (me === undefined || me.nickname === null || presence === null) return null;
    return {
      me: { ...me, nickname: me.nickname },
      channels: presence.channels,
      onlineCount: presence.onlineCount,
      stale: (data?.stale ?? false) || channelsError !== undefined,
      channelsLoading: loading && data === undefined,
      activeSlug,
      connection,
      audioPrefs: prefs,
      updateAudioPrefs: update,
      selectChannel,
      join,
      leave,
      reportParticipants,
      setConnection,
      openSettings,
      openInvite: () => setInviteOpen(true),
      refreshMe,
    };
  }, [
    me,
    presence,
    data,
    channelsError,
    loading,
    activeSlug,
    connection,
    prefs,
    update,
    selectChannel,
    join,
    leave,
    reportParticipants,
    openSettings,
    refreshMe,
  ]);

  if (state === null) return <AppBooting />;

  return (
    <AppContextProvider value={state}>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.content}>{children}</div>
      </div>
      <SettingsModal open={settingsOpen} onClose={closeSettings} />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </AppContextProvider>
  );
}
