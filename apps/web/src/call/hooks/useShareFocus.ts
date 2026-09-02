'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import type { LocalTrackPublication, RemoteTrackPublication, Room } from 'livekit-client';

export type ShareFocus = {
  /** Tela escolhida à mão; `null` deixa a decisão para `resolveFocusedShare`. */
  selected: string | null;
  /** `true` quando o usuário saiu do foco: a grade volta sem parar o compartilhamento. */
  gridForced: boolean;
  focusShare: (trackSid: string) => void;
  exitFocus: () => void;
};

/**
 * Quem chega compartilhando ganha o foco. É evento da sala, não estado derivado: uma
 * publicação nova é justamente a informação de "mais recente" que a lista de tracks
 * não carrega.
 */
export function useShareFocus(room: Room): ShareFocus {
  const [selected, setSelected] = useState<string | null>(null);
  const [gridForced, setGridForced] = useState(false);

  useEffect(() => {
    const take = (publication: RemoteTrackPublication | LocalTrackPublication): void => {
      if (publication.source !== Track.Source.ScreenShare) return;
      setSelected(publication.trackSid);
      setGridForced(false);
    };
    room.on(RoomEvent.TrackPublished, take).on(RoomEvent.LocalTrackPublished, take);
    return () => {
      room.off(RoomEvent.TrackPublished, take).off(RoomEvent.LocalTrackPublished, take);
    };
  }, [room]);

  const focusShare = useCallback((trackSid: string): void => {
    setSelected(trackSid);
    setGridForced(false);
  }, []);

  const exitFocus = useCallback((): void => setGridForced(true), []);

  return { selected, gridForced, focusShare, exitFocus };
}
