import { Spinner } from '@/components/ui/Spinner';

/** Pantalla de espera mientras se resuelve la sesión (nunca vacío). */
export function FullPageLoading({ label = 'Cargando sesión…' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        gap: 'var(--sp-3)',
      }}
      role="status"
    >
      <Spinner size={24} />
      <p style={{ color: 'var(--humo)', fontSize: 'var(--fs-meta)' }}>{label}</p>
    </div>
  );
}
