import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: number;
  className?: string;
  /** Texto accesible; vacío si el control contenedor ya describe la espera. */
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
