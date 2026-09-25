import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableProps {
  children: ReactNode;
  /** Etiqueta accesible de la tabla. */
  label: string;
  /** Columnas numéricas se alinean a la derecha con cifras tabulares. */
  className?: string;
}

/** Carcasa de tabla: encabezado denso, filas con separación tonal (sin líneas duras). */
export function Table({ children, label, className }: TableProps) {
  return (
    <div className={[styles.scroll, className].filter(Boolean).join(' ')}>
      <table className={styles.table} aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className={styles.thead}>{children}</thead>;
}

export function TR({ children, ...rest }: ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr className={styles.row} {...rest}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = 'left',
  ...rest
}: ComponentPropsWithoutRef<'th'> & { align?: 'left' | 'right' }) {
  return (
    <th className={styles.th} style={{ textAlign: align }} scope="col" {...rest}>
      {children}
    </th>
  );
}

export function TD({
  children,
  align = 'left',
  numeric = false,
  ...rest
}: ComponentPropsWithoutRef<'td'> & { align?: 'left' | 'right'; numeric?: boolean }) {
  return (
    <td
      className={[styles.td, numeric ? styles.numeric : ''].filter(Boolean).join(' ')}
      style={{ textAlign: align }}
      {...rest}
    >
      {children}
    </td>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className={styles.tbody}>{children}</tbody>;
}
