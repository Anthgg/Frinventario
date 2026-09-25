import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setAccessToken } from '@/api/client';
import type { AuthSessionUser, RoleCode } from '@/types/auth';

/**
 * Infraestructura de auth.
 *
 * FF000 conserva una sesión local UI_MOCK para navegar y prepara la estructura
 * del estado de auth. Los endpoints reales se definen por separado y empiezan en FF001.
 */

const STORAGE_KEY = 'dedalo.auth.session';

export interface StoredSession {
  user: AuthSessionUser;
  permissions: string[];
  demo: boolean;
}

export type AuthStatus = 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: AuthSessionUser | null;
  roles: RoleCode[];
  permissions: string[];
  authenticated: boolean;
  loading: boolean;
  isDemo: boolean;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signInDemo: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<StoredSession>;
    if (!candidate.user || !Array.isArray(candidate.permissions) || candidate.demo !== true) return null;
    return {
      user: candidate.user,
      permissions: candidate.permissions,
      demo: candidate.demo === true,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

const DEMO_USER: AuthSessionUser = {
  id: 'usr-demo-0001',
  email: 'operador.demo@dedalo.local',
  display_name: 'Operador Demo',
  is_active: true,
  roles: ['SUPERVISOR'],
};

const DEMO_PERMISSIONS: string[] = [
  'auth.self.read',
  'inventory.read',
  'inventory.count',
  'inventory.recount',
  'inventory.monitor',
  'inventory.reconcile',
  'exports.read',
  'damage.report',
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restauración diferida: evita cascadas de render y deja visible el estado
    // `loading` (la sesión puede volverse asíncrona en FF001 con refresh).
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSession(readStoredSession());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((next: StoredSession | null) => {
    setSession(next);
    writeStoredSession(next);
  }, []);

  const signInDemo = useCallback(() => {
    setAccessToken(null);
    applySession({ user: DEMO_USER, permissions: DEMO_PERMISSIONS, demo: true });
  }, [applySession]);

  const login = useCallback(
    async (_email: string, _password: string) => {
      // FF000 does not send credentials; this form enters the local demo session.
      signInDemo();
    },
    [signInDemo],
  );

  const logout = useCallback(async () => {
    setSession(null);
    writeStoredSession(null);
    setAccessToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const permissions = session?.permissions ?? [];
    return {
      user,
      roles: user?.roles ?? [],
      permissions,
      authenticated: user !== null,
      loading,
      isDemo: session?.demo === true,
      status: user ? 'authenticated' : 'anonymous',
      login,
      signInDemo,
      logout,
    };
  }, [session, loading, login, signInDemo, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
