'use client';

import { useId, useRef } from 'react';
import type { ClipboardEvent, JSX, KeyboardEvent } from 'react';
import { CODE_LENGTH, INVITE_ALPHABET } from '@kingdc/contracts';
import { cx } from './classes';
import styles from './CodeInput.module.css';

export type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Mantém só caracteres do alfabeto de convite (decisão D2), sempre em maiúsculo. */
function sanitize(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((char) => INVITE_ALPHABET.includes(char))
    .join('')
    .slice(0, CODE_LENGTH);
}

export function CodeInput({
  value,
  onChange,
  label = 'Código de convite',
  error,
  disabled = false,
  autoFocus = false,
}: CodeInputProps): JSX.Element {
  const groupId = useId();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number): void => {
    boxes.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)]?.focus();
  };

  const handleInput = (index: number, raw: string): void => {
    const clean = sanitize(raw);
    if (clean.length === 0) {
      onChange(sanitize(value.slice(0, index) + value.slice(index + 1)));
      return;
    }
    if (clean.length > 1) {
      onChange(sanitize(value.slice(0, index) + clean));
      focusBox(index + clean.length);
      return;
    }
    onChange(sanitize(value.slice(0, index) + clean + value.slice(index + 1)));
    focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Backspace' && value[index] === undefined) {
      event.preventDefault();
      onChange(value.slice(0, Math.max(index - 1, 0)));
      focusBox(index - 1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    const pasted = sanitize(event.clipboardData.getData('text'));
    onChange(sanitize(value.slice(0, index) + pasted));
    focusBox(index + pasted.length);
  };

  return (
    <div className={cx(styles.wrapper, error !== undefined && styles.invalid)}>
      <span className={styles.label} id={`${groupId}-label`}>
        {label}
      </span>
      <div className={styles.boxes} role="group" aria-labelledby={`${groupId}-label`}>
        {Array.from({ length: CODE_LENGTH }, (_unused, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            className={cx(styles.box, value[index] !== undefined && styles.filled)}
            value={value[index] ?? ''}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={CODE_LENGTH}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Caractere ${index + 1} de ${CODE_LENGTH}`}
          />
        ))}
      </div>
      {error !== undefined ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}
