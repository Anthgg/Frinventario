import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth, RequirePermission } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { CampaignDetailPage } from '@/features/inventarios/CampaignDetailPage';
import { InventariosPage } from '@/features/inventarios/InventariosPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CountSessionRoute } from '@/features/conteo/CountSessionPage';
import {
  ConfiguracionPage,
  DocumentsPage,
  NotFoundPage,
  RecountsPage,
  ReconciliationPage,
} from '@/features/misc/PlaceholderPages';

/**
 * Mapa de rutas (FF001): sesión REAL vía /auth/me.
 * Cada módulo exige el permiso que su endpoint del backend exige; sin permiso
 * se muestra 403 (nunca se redirige al login de un usuario ya autenticado).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="inventarios"
          element={
            <RequirePermission permission="inventory.read">
              <InventariosPage />
            </RequirePermission>
          }
        />
        <Route
          path="inventarios/:campaignId"
          element={
            <RequirePermission permission="inventory.read">
              <CampaignDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="conteo/:sessionId"
          element={
            <RequirePermission permission="inventory.count">
              <CountSessionRoute />
            </RequirePermission>
          }
        />
        <Route
          path="reconteos"
          element={
            <RequirePermission permission="inventory.recount">
              <RecountsPage />
            </RequirePermission>
          }
        />
        <Route
          path="conciliacion/:campaignId"
          element={
            <RequirePermission permission="inventory.reconcile">
              <ReconciliationPage />
            </RequirePermission>
          }
        />
        <Route
          path="documentos"
          element={
            <RequirePermission permission="exports.read">
              <DocumentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="configuracion"
          element={
            <RequirePermission permission="system.manage">
              <ConfiguracionPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

/** Proveedor global: contención de errores + sesión + notificaciones. */
export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
