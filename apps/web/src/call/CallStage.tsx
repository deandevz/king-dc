'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, MouseEvent } from 'react';
import { Track } from 'livekit-client';
import {
  RoomAudioRenderer,
  useAudioPlayback,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import type { PresenceParticipant } from '@kingdc/contracts';
import type { CallConnectionState, AudioPrefs } from './types';
import { AudioGate } from './AudioGate';
import { ControlBar } from './controls/ControlBar';
import { useAudioDevices } from './hooks/useAudioDevices';
import { useCallConnection } from './hooks/useCallConnection';
import { useCallSounds } from './hooks/useCallSounds';
import { useDeafen } from './hooks/useDeafen';
import { usePresenceReport } from './hooks/usePresenceReport';
import { usePushToTalk } from './hooks/usePushToTalk';
import { useRemoteVolumes } from './hooks/useRemoteVolumes';
import { useScreenShare } from './hooks/useScreenShare';
import { useShareFocus } from './hooks/useShareFocus';
import { useUserVolumes } from './hooks/useUserVolumes';
import { micEnabledAfterDeafChange, micEnabledForMode } from './lib/policies';
import { deafSound, micSound } from './lib/sounds';
import { pttKeyLabel } from './lib/pttLabel';
import { buildTiles, resolveFocusedShare } from './lib/tiles';
import type { CallTile } from './lib/tiles';
import { userVolume } from './lib/volumes';
import { ParticipantTile } from './tiles/ParticipantTile';
import { ShareStage } from './tiles/ShareStage';
import { VolumeMenu } from './tiles/VolumeMenu';
import styles from './CallStage.module.css';

export type CallStageProps = {
  audioPrefs: AudioPrefs;
  leaving: boolean;
  onConnectionChange: (state: CallConnectionState) => void;
  onOpenSettings: () => void;
  onLeaveIntent: () => void;
  onLeave: () => void;
  onParticipantsChange?: (participants: PresenceParticipant[]) => void;
};

const BANNER: Partial<Record<CallConnectionState, string>> = {
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
};

/** Tudo que precisa do contexto da sala. Só é montado dentro de `LiveKitRoom`. */
export function CallStage({
  audioPrefs,
  leaving,
  onConnectionChange,
  onOpenSettings,
  onLeaveIntent,
  onLeave,
  onParticipantsChange,
}: CallStageProps): JSX.Element {
  const room = useRoomContext();
  const connection = useCallConnection(leaving, onConnectionChange);
  const participants = useParticipants();
  const shareTracks = useTracks([Track.Source.ScreenShare]);
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const { deafened, setDeafened } = useDeafen(room);
  const { volumes, setVolume } = useUserVolumes();
  useRemoteVolumes(room, deafened, audioPrefs.outputVolume, volumes);
  const screenShare = useScreenShare(room);
  useAudioDevices(room, audioPrefs);
  const playSound = useCallSounds(room, audioPrefs);

  const setMic = useCallback(
    (enabled: boolean): void => {
      void localParticipant.setMicrophoneEnabled(enabled).catch(() => undefined);
    },
    [localParticipant],
  );

  const { inputMode, pttKey } = audioPrefs;
  usePushToTalk(inputMode === 'ptt', pttKey, setMic);

  // O estado inicial do microfone vem da prop `audio` da sala; aqui só reagimos à troca
  // de modo em tempo real, para não desfazer um mudo manual a cada render.
  const previousModeRef = useRef(inputMode);
  useEffect(() => {
    if (previousModeRef.current === inputMode) return;
    previousModeRef.current = inputMode;
    setMic(micEnabledForMode(inputMode));
  }, [inputMode, setMic]);

  const sharingIdentities = useMemo(
    () => shareTracks.map((reference) => reference.participant.identity),
    [shareTracks],
  );
  usePresenceReport(
    participants,
    sharingIdentities,
    connection === 'connected',
    onParticipantsChange,
  );

  const tiles = useMemo(
    () =>
      buildTiles(
        participants.map((participant) => ({
          identity: participant.identity,
          name: participant.name,
          metadata: participant.metadata,
          isLocal: participant.isLocal,
        })),
        sharingIdentities,
      ),
    [participants, sharingIdentities],
  );
  const participantByIdentity = useMemo(
    () => new Map(participants.map((participant) => [participant.identity, participant])),
    [participants],
  );
  const shareSidByIdentity = useMemo(
    () =>
      new Map(
        shareTracks.map((reference) => [
          reference.participant.identity,
          reference.publication.trackSid,
        ]),
      ),
    [shareTracks],
  );

  // Menu de volume aberto pelo botão direito num tile remoto (decisão D26).
  const [menu, setMenu] = useState<{ tile: CallTile; x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const contextMenuFor = (tile: CallTile) =>
    tile.isLocal
      ? {}
      : {
          onContextMenu: (event: MouseEvent<HTMLElement>) => {
            event.preventDefault();
            setMenu({ tile, x: event.clientX, y: event.clientY });
          },
        };

  const { selected, gridForced, focusShare, exitFocus } = useShareFocus(room);
  const liveShareSids = shareTracks.map((reference) => reference.publication.trackSid);
  const focusedSid = resolveFocusedShare(liveShareSids, selected);
  const focusedTrack =
    shareTracks.find((reference) => reference.publication.trackSid === focusedSid) ?? null;
  const showFocus = focusedTrack !== null && !gridForced;
  const focusedName =
    tiles.find((tile) => tile.identity === focusedTrack?.participant.identity)?.nickname ?? '';

  const toggleDeaf = useCallback((): void => {
    const next = !deafened;
    playSound(deafSound(next));
    setDeafened(next);
    setMic(micEnabledAfterDeafChange(next, inputMode));
  }, [deafened, inputMode, playSound, setDeafened, setMic]);

  const toggleMic = useCallback((): void => {
    playSound(micSound(!isMicrophoneEnabled));
    setMic(!isMicrophoneEnabled);
  }, [isMicrophoneEnabled, playSound, setMic]);

  const handleLeave = useCallback((): void => {
    onLeaveIntent();
    playSound('saiu');
    void (async () => {
      await localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      await room.disconnect().catch(() => undefined);
      onLeave();
    })();
  }, [localParticipant, onLeave, onLeaveIntent, playSound, room]);

  return (
    <div className={styles.stage}>
      <RoomAudioRenderer />

      {connection === 'connected' ? null : (
        <div className={styles.banner} role="status">
          {BANNER[connection] ?? 'Conectando…'}
        </div>
      )}

      {showFocus && focusedTrack !== null ? (
        <div className={styles.focusArea}>
          <ShareStage
            trackRef={focusedTrack}
            sharerName={focusedName}
            onExitFocus={exitFocus}
          />
          <div className={styles.strip}>
            {tiles.map((tile) => {
              const participant = participantByIdentity.get(tile.identity);
              if (participant === undefined) return null;
              const sid = shareSidByIdentity.get(tile.identity);
              const otherShare = sid !== undefined && sid !== focusedSid;
              return (
                <ParticipantTile
                  key={tile.identity}
                  participant={participant}
                  tile={tile}
                  variant="strip"
                  {...(otherShare ? { onClick: () => focusShare(sid) } : {})}
                  {...contextMenuFor(tile)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {tiles.map((tile) => {
            const participant = participantByIdentity.get(tile.identity);
            if (participant === undefined) return null;
            const sid = shareSidByIdentity.get(tile.identity);
            return (
              <ParticipantTile
                key={tile.identity}
                participant={participant}
                tile={tile}
                variant="grid"
                {...(sid === undefined ? {} : { onClick: () => focusShare(sid) })}
                {...contextMenuFor(tile)}
              />
            );
          })}
        </div>
      )}

      {menu === null ? null : (
        <VolumeMenu
          nickname={menu.tile.nickname}
          value={userVolume(volumes, menu.tile.identity)}
          x={menu.x}
          y={menu.y}
          onChange={(value) => setVolume(menu.tile.identity, value)}
          onClose={closeMenu}
        />
      )}

      {canPlayAudio ? null : <AudioGate onStart={startAudio} />}

      <ControlBar
        micEnabled={isMicrophoneEnabled}
        deafened={deafened}
        sharing={isScreenShareEnabled}
        pttHint={inputMode === 'ptt' ? pttKeyLabel(pttKey) : null}
        onToggleMic={toggleMic}
        onToggleDeaf={toggleDeaf}
        onToggleShare={() => (isScreenShareEnabled ? screenShare.stop() : screenShare.start())}
        onOpenSettings={onOpenSettings}
        onLeave={handleLeave}
      />
    </div>
  );
}
