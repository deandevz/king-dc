import { useId } from 'react';
import type { JSX, ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import styles from './Select.module.css';

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> & {
  label: string;
  options: SelectOption[];
  icon?: ReactNode;
  /** Texto mostrado quando não há nenhuma opção disponível. */
  emptyLabel?: string;
};

/** Select com a mesma casca do campo de texto: 46px, ícone à esquerda, chevron à direita. */
export function Select({
  label,
  options,
  icon,
  emptyLabel = 'Nenhum dispositivo',
  id,
  ...props
}: SelectProps): JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <div className={styles.control}>
        {icon}
        <select id={selectId} className={styles.select} disabled={options.length === 0} {...props}>
          {options.length === 0 ? (
            <option value="">{emptyLabel}</option>
          ) : (
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
        <Icon name="chevronDown" size={17} className={styles.chevron} />
      </div>
    </div>
  );
}
