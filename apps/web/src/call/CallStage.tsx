'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
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
import { useDeafen } from './hooks/useDeafen';
import { usePresenceReport } from './hooks/usePresenceReport';
import { usePushToTalk } from './hooks/usePushToTalk';
import { useScreenShare } from './hooks/useScreenShare';
import { useShareFocus } from './hooks/useShareFocus';
import { micEnabledAfterDeafChange, micEnabledForMode } from './lib/policies';
import { pttKeyLabel } from './lib/pttLabel';
import { buildTiles, resolveFocusedShare } from './lib/tiles';
import { ParticipantTile } from './tiles/ParticipantTile';
import { ShareStage } from './tiles/ShareStage';
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
  const { deafened, volume, setDeafened } = useDeafen(room, audioPrefs.outputVolume);
  const screenShare = useScreenShare(room);
  useAudioDevices(room, audioPrefs);

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
    setDeafened(next);
    if (!micEnabledAfterDeafChange(next, isMicrophoneEnabled)) setMic(false);
  }, [deafened, isMicrophoneEnabled, setDeafened, setMic]);

  const handleLeave = useCallback((): void => {
    onLeaveIntent();
    void (async () => {
      await localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      await room.disconnect().catch(() => undefined);
      onLeave();
    })();
  }, [localParticipant, onLeave, onLeaveIntent, room]);

  return (
    <div className={styles.stage}>
      <RoomAudioRenderer volume={volume} />

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
              />
            );
          })}
        </div>
      )}

      {canPlayAudio ? null : <AudioGate onStart={startAudio} />}

      <ControlBar
        micEnabled={isMicrophoneEnabled}
        deafened={deafened}
        sharing={isScreenShareEnabled}
        pttHint={inputMode === 'ptt' ? pttKeyLabel(pttKey) : null}
        onToggleMic={() => setMic(!isMicrophoneEnabled)}
        onToggleDeaf={toggleDeaf}
        onToggleShare={() => (isScreenShareEnabled ? screenShare.stop() : screenShare.start())}
        onOpenSettings={onOpenSettings}
        onLeave={handleLeave}
      />
    </div>
  );
}
