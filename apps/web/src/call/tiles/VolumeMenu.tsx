'use client';

import type { JSX } from 'react';
import { Popover, Slider } from '@/ui';
import { volumeLabel } from '../lib/volumes';

export type VolumeMenuProps = {
  nickname: string;
  value: number;
  x: number;
  y: number;
  onChange: (value: number) => void;
  onClose: () => void;
};

/** Menu do botão direito no tile: volume individual, de 0 a 100% (decisão D26). */
export function VolumeMenu({
  nickname,
  value,
  x,
  y,
  onChange,
  onClose,
}: VolumeMenuProps): JSX.Element {
  return (
    <Popover x={x} y={y} label={`Volume de ${nickname}`} onClose={onClose}>
      <Slider
        label={`Volume de ${nickname}`}
        value={value}
        onChange={onChange}
        valueLabel={volumeLabel(value)}
      />
    </Popover>
  );
}
