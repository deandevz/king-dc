import type { CSSProperties, JSX } from 'react';
import { cx } from './classes';
import { avatarGradientIndex, avatarInitial } from './avatarGradient';
import styles from './Avatar.module.css';

export type AvatarProps = {
  userId: string;
  nickname: string | null;
  avatarUrl?: string | null;
  size?: number;
  speaking?: boolean;
  muted?: boolean;
  className?: string;
};

/** Anel de "falando": a intensidade do glow escala com o tamanho. */
function speakingRing(size: number): string {
  if (size <= 24) return 'var(--kd-ring-speaking-sm)';
  if (size <= 60) return '0 0 0 2px var(--kd-accent), var(--kd-shadow-speaking-tile)';
  return '0 0 0 2px var(--kd-accent), var(--kd-shadow-speaking-avatar)';
}

export function Avatar({
  userId,
  nickname,
  avatarUrl = null,
  size = 34,
  speaking = false,
  muted = false,
  className,
}: AvatarProps): JSX.Element {
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
    background: `var(--kd-avatar-${avatarGradientIndex(userId)})`,
    boxShadow: speaking ? speakingRing(size) : undefined,
  };

  return (
    <span
      className={cx(styles.avatar, speaking && styles.speaking, muted && styles.muted, className)}
      style={style}
    >
      {avatarUrl === null ? (
        avatarInitial(nickname)
      ) : (
        // Sem next/image: a URL vem da API pelo rewrite e já sai em 256×256 WebP.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photo} src={avatarUrl} alt="" width={size} height={size} />
      )}
    </span>
  );
}
