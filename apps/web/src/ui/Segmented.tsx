import type { JSX } from 'react';
import { cx } from './classes';
import styles from './Segmented.module.css';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string> = {
  label?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>): JSX.Element {
  return (
    <div className={styles.wrapper}>
      {label !== undefined ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.track} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={cx(styles.option, option.value === value && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
