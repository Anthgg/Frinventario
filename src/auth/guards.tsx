import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { hasAnyPermission, hasPermission, type PermissionInput } from './permissions';
import { sanitizeReturnTo } from './returnUrl';
import { FullPageLoading } from '@/components/layout/FullPageLoading';
import { ErrorState } from '@/components/ui/State';

/**
 * Guards de UX: ocultan rutas que el usuario no debería ver.
 * La seguridad real vive en el backend (el frontend no es autoridad).
 */

function returnState(pathname: string, search: string): { from: string } {
  return { from: sanitizeReturnTo(`${pathname}${search}`) };
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  // Bootstrap (refresh + me) pendiente: nunca parpadear la ruta privada.
  if (loading) return <FullPageLoading />;
  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={returnState(location.pathname, location.search)}
      />
    );
  }
  return <>{children}</>;
}

export interface RequirePermissionProps {
  permission?: PermissionInput;
  anyOf?: readonly PermissionInput[];
  children: ReactNode;
}

export function RequirePermission({ permission, anyOf, children }: RequirePermissionProps) {
  const { authenticated, loading, permissions } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoading />;
  if (!authenticated) {
    // Sin sesión: al login preservando el destino. Con sesión: 403 real.
    return (
      <Navigate
        to="/login"
        replace
        state={returnState(location.pathname, location.search)}
      />
    );
  }

  const allowed =
    permission !== undefined
      ? hasPermission(permissions, permission)
      : anyOf !== undefined
        ? hasAnyPermission(permissions, anyOf)
        : true;

  if (!allowed) {
    return (
      <ErrorState
        title="Acceso restringido"
        description="Tu permiso no incluye este módulo. Si necesitas acceso, pídeselo a un supervisor."
        error={undefined}
      />
    );
  }

  return <>{children}</>;
}
