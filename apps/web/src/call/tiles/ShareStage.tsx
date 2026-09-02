'use client';

import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { TrackReference } from '@livekit/components-react';
import { Icon } from '@/ui';
import styles from './ShareStage.module.css';

export type ShareStageProps = {
  trackRef: TrackReference;
  sharerName: string;
  onExitFocus: () => void;
};

/**
 * Frame 16:9 da tela em foco (máx. 996×560). O `<video>` é atado à track na
 * mão: os componentes visuais prontos do LiveKit ficam de fora por regra do projeto.
 */
export function ShareStage({ trackRef, sharerName, onExitFocus }: ShareStageProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = trackRef.publication.track;

  useEffect(() => {
    const element = videoRef.current;
    if (element === null || track === undefined) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <div className={styles.frame}>
      <video ref={videoRef} className={styles.video} autoPlay playsInline muted />
      <div className={styles.chip}>
        <span className={styles.dot} />
        <span>{sharerName} está compartilhando a tela</span>
      </div>
      <button
        type="button"
        className={styles.exit}
        onClick={onExitFocus}
        aria-label="Sair do foco da tela"
        title="Sair do foco da tela"
      >
        <Icon name="expand" size={16} />
      </button>
    </div>
  );
}
