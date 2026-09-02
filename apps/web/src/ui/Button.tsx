import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from './classes';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Raio de pílula: usado em "Entrar no canal" e no "Sair" da barra de controles. */
  pill?: boolean;
  compact?: boolean;
  block?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  pill = false,
  compact = false,
  block = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        styles.base,
        styles[variant],
        pill && styles.pill,
        compact && styles.compact,
        block && styles.block,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `round` é o botão de 46px da barra de call; `square` é o de 32px do dock. */
  shape?: 'round' | 'square';
  tone?: 'neutral' | 'active' | 'danger';
  label: string;
  children: ReactNode;
};

export function IconButton({
  shape = 'round',
  tone = 'neutral',
  label,
  className,
  type = 'button',
  children,
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        styles.icon,
        shape === 'round' ? styles.iconRound : styles.iconSquare,
        tone === 'active' && styles.iconActive,
        tone === 'danger' && styles.iconDanger,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
