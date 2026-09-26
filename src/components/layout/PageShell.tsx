import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shell de vista de módulo (regla FF001 FULL_WORKSPACE):
 * ocupa TODO el ancho disponible del workspace. Sin max-width global,
 * sin contenedor centrado, sin "mega-card" envolvente.
 * El ancho lo decide el layout (sidebar/rail/móvil); aquí solo se garantiza
 * que la página crezca con el viewport.
 */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={[styles.shell, className].filter(Boolean).join(' ')}>{children}</div>;
}
