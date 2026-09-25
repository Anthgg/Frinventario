import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { hasAnyPermission, hasPermission, type PermissionInput } from './permissions';
import { FullPageLoading } from '@/components/layout/FullPageLoading';
import { ErrorState } from '@/components/ui/State';

/**
 * Guards de UX: ocultan rutas que el usuario no debería ver.
 * La seguridad real vive en el backend (el frontend no es autoridad).
 */

export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoading />;
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
        description="Tu rol no incluye este módulo. Si necesitas acceso, pídeselo a un supervisor."
        error={undefined}
      />
    );
  }

  return <>{children}</>;
}
