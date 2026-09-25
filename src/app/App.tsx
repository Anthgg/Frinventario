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
import { CountSessionPage } from '@/features/conteo/CountSessionPage';
import {
  ConfiguracionPage,
  DocumentsPage,
  NotFoundPage,
  RecountsPage,
  ReconciliationPage,
} from '@/features/misc/PlaceholderPages';

/**
 * Mapa de rutas (FF000): todas navegables con placeholders reales.
 * Los guards de permiso se aplican en los módulos de control; los módulos
 * restantes se restringen cuando el backend los entregue.
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
        <Route path="inventarios" element={<InventariosPage />} />
        <Route path="inventarios/:campaignId" element={<CampaignDetailPage />} />
        <Route path="conteo/:sessionId" element={<CountSessionPage />} />
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
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
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
