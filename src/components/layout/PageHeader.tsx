import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  /** Número o dato que encabeza la página ( jerarquía focal ). */
  meta?: ReactNode;
}

export function PageHeader({ title, description, actions, badge, meta }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.lead}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {badge}
        </div>
        {description ? <p className={styles.description}>{description}</p> : null}
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
