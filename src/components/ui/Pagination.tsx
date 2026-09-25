import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './Button';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({ page, pageCount, onPageChange, label = 'Paginación' }: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav className={styles.nav} aria-label={label}>
      <IconButton
        label="Página anterior"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </IconButton>
      <ol className={styles.pages}>
        {pages.map((current) => (
          <li key={current}>
            <button
              type="button"
              className={[styles.page, current === page ? styles.current : '']
                .filter(Boolean)
                .join(' ')}
              aria-current={current === page ? 'page' : undefined}
              onClick={() => onPageChange(current)}
            >
              {current}
            </button>
          </li>
        ))}
      </ol>
      <IconButton
        label="Página siguiente"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} />
      </IconButton>
    </nav>
  );
}
