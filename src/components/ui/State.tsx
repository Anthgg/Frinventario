import { Inbox, RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/errors';
import { Badge } from './Badge';
import { Button } from './Button';
import styles from './State.module.css';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

/** Vacío intencional: dice qué falta y qué hacer, no deja un hueco. */
export function EmptyState({ title, description, action, icon, compact }: EmptyStateProps) {
  return (
    <div className={[styles.state, compact ? styles.compact : ''].filter(Boolean).join(' ')}>
      <span className={styles.iconWrap} aria-hidden="true">
        {icon ?? <Inbox size={20} />}
      </span>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  error?: unknown;
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

function readError(error: unknown): { code?: string; message?: string } {
  if (error instanceof ApiError) {
    return { code: error.status > 0 ? `HTTP ${error.status}` : error.code, message: error.message };
  }
  if (error instanceof Error) return { message: error.message };
  return {};
}

/** Error mostrado al usuario: código + mensaje. Nunca stack traces. */
export function ErrorState({
  error,
  title = 'No pudimos cargar esto',
  description,
  onRetry,
  retryLabel = 'Reintentar',
  compact = false,
}: ErrorStateProps) {
  const { code, message } = readError(error);
  return (
    <div
      className={[styles.state, styles.error, compact ? styles.compact : ''].filter(Boolean).join(' ')}
      role="alert"
    >
      <span className={[styles.iconWrap, styles.errorIcon].join(' ')} aria-hidden="true">
        <TriangleAlert size={20} />
      </span>
      <div className={styles.errorHeadline}>
        <p className={styles.title}>{title}</p>
        {code ? (
          <Badge tone="danger" className={styles.code}>
            {code}
          </Badge>
        ) : null}
      </div>
      <p className={styles.description}>{description ?? message ?? 'Intenta de nuevo en un momento.'}</p>
      {onRetry ? (
        <div className={styles.action}>
          <Button variant="secondary" onClick={onRetry}>
            <RotateCw size={14} />
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
