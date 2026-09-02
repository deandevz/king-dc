import { useId } from 'react';
import type { InputHTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from './classes';
import styles from './Field.module.css';

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  /** Ícone à esquerda, como o cadeado da senha no login. */
  icon?: ReactNode;
  hint?: string;
  error?: string;
  /** Contador "5 / 24" à direita do rodapé. */
  counter?: string;
  className?: string;
};

export function Field({
  label,
  icon,
  hint,
  error,
  counter,
  className,
  id,
  readOnly,
  ...props
}: FieldProps): JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const footer = error ?? hint;

  return (
    <div
      className={cx(styles.wrapper, readOnly && styles.readOnly, error && styles.invalid, className)}
    >
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.control}>
        {icon}
        <input
          id={inputId}
          className={styles.input}
          readOnly={readOnly}
          aria-invalid={error !== undefined}
          {...props}
        />
      </div>
      {footer !== undefined || counter !== undefined ? (
        <div className={styles.footer}>
          <span className={cx(error !== undefined && styles.error)}>{footer ?? ''}</span>
          {counter !== undefined ? <span>{counter}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
