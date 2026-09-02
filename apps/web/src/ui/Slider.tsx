import { useId } from 'react';
import type { CSSProperties, JSX } from 'react';
import styles from './Slider.module.css';

export type SliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Texto à direita do rótulo, tipo "72%". */
  valueLabel?: string;
  disabled?: boolean;
};

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  valueLabel,
  disabled = false,
}: SliderProps): JSX.Element {
  const id = useId();
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const style = { '--kd-fill': `${percent}%` } as CSSProperties;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {valueLabel !== undefined ? <span className={styles.value}>{valueLabel}</span> : null}
      </label>
      <input
        id={id}
        type="range"
        className={styles.input}
        style={style}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
