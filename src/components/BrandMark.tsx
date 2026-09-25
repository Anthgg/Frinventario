import styles from './BrandMark.module.css';

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Marca: laberinto cuadrado con el hilo de oro entrando hasta el centro.
 * El hilo es la firma del producto — también marca navegación, foco y progreso.
 */
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={[styles.mark, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.5H21.5V21.5H2.5V7H17V17H7V11.5H12.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.85"
      />
      <path
        d="M12 2.5V7M7 11.5H12.75"
        stroke="var(--hilo)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12.75" cy="11.5" r="1.6" fill="var(--hilo)" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.wordmark}>
      <span className={styles.name}>DEDALO</span>
      {compact ? null : <span className={styles.sub}>Inventario</span>}
    </span>
  );
}
