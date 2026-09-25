import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastTone = 'default' | 'success' | 'warning' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current, { ...toast, id }]);
      const duration = toast.duration ?? 5000;
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="region" aria-label="Notificaciones">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[styles.toast, styles[toast.tone ?? 'default']].join(' ')}
            role={toast.tone === 'danger' ? 'alert' : 'status'}
          >
            <div className={styles.body}>
              <p className={styles.title}>{toast.title}</p>
              {toast.description ? <p className={styles.description}>{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="Cerrar notificación"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return context;
}
