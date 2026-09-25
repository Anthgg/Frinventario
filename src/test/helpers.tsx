import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { App } from '@/app/App';
import type { StoredSession } from '@/auth/AuthProvider';

export const TEST_SESSION: StoredSession = {
  user: {
    id: 'usr-test',
    email: 'tester@dedalo.local',
    display_name: 'Tester Dedalo',
    is_active: true,
    roles: ['SUPERVISOR'],
  },
  permissions: [
    'inventory.read',
    'inventory.count',
    'inventory.recount',
    'inventory.reconcile',
  ],
  demo: true,
};

export const STORAGE_KEY = 'dedalo.auth.session';

export function seedSession(session: StoredSession | null = TEST_SESSION): void {
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** App completa (auth + toasts + rutas) dentro de un router de memoria. */
export function renderApp(initialPath = '/app/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

export function renderWithRouter(ui: ReactElement, initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);
}
