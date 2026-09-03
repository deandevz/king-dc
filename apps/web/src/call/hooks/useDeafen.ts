'use client';

import { useEffect, useState } from 'react';
import type { Room } from 'livekit-client';
import { DEAFENED_ATTRIBUTE, DEAFENED_ON } from '@kingdc/contracts';

export type DeafenState = {
  deafened: boolean;
  setDeafened: (next: boolean) => void;
};

/**
 * Ensurdecer é client-side: o LiveKit não tem o conceito. O volume zero é aplicado por
 * `useRemoteVolumes`; aqui só o estado e o atributo que avisa os outros (decisão D9).
 */
export function useDeafen(room: Room): DeafenState {
  const [deafened, setDeafened] = useState(false);

  useEffect(() => {
    const local = room.localParticipant;
    // Antes de conectar não há o que publicar; o valor inicial é "ouvindo" de qualquer jeito.
    if (!deafened && local.attributes[DEAFENED_ATTRIBUTE] !== DEAFENED_ON) return;
    void local
      .setAttributes({ [DEAFENED_ATTRIBUTE]: deafened ? DEAFENED_ON : '' })
      .catch(() => undefined);
  }, [room, deafened]);

  return { deafened, setDeafened };
}
