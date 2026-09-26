import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getAccessToken,
  setApiAuthHandler,
  type ApiAuthHandler,
} from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchMe, loginWithCredentials, logoutRemote } from './authService';
import { refreshSession, type RefreshOutcome } from './refreshController';
import { clearTokens, readRefreshToken } from './tokenStorage';
import type { AuthSessionUser, MeResponse, RoleCode } from '@/types/auth';

/**
 * Estado de autenticación REAL contra el backend congelado.
 *
 * - status: "loading" (bootstrap refresh+me) | "authenticated" | "anonymous"
 * - identidad, roles y permisos salen SIEMPRE de GET /auth/me.
 * - access_token en memoria; refresh_token en sessionStorage.
 * - sin sesión demo: la única entrada son credenciales reales.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type SessionNotice = 'expired' | 'unavailable';

export interface AuthContextValue {
  status: AuthStatus;
  authenticated: boolean;
  loading: boolean;
  user: AuthSessionUser | null;
  roles: RoleCode[];
  permissions: string[];
  accessToken: string | null;
  /** Error de red del bootstrap: la sesión local no se destruye por eso. */
  bootstrapError: ApiError | null;
  /** Aviso único de sesión cerrada; se limpia en el próximo intento. */
  sessionNotice: SessionNotice | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Sale sin confirmación remota (solo se usa cuando el backend no responde).
   * La UI nunca afirma que la sesión del servidor fue cerrada.
   */
  endLocalSession: () => void;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(me: MeResponse): AuthSessionUser {
  return {
    id: me.id,
    email: me.email,
    display_name: me.display_name,
    is_active: me.is_active,
    roles: me.roles,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<MeResponse | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(() => getAccessToken());
  const [status, setStatus] = useState<AuthStatus>(() =>
    readRefreshToken() ? 'loading' : 'anonymous',
  );
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const [bootstrapError, setBootstrapError] = useState<ApiError | null>(null);
  const bootstrapped = useRef(false);

  const clearSession = useCallback((notice: SessionNotice | null = null) => {
    clearTokens();
    setIdentity(null);
    setAccessTokenState(null);
    setStatus('anonymous');
    setSessionNotice(notice);
  }, []);

  /** La sesión terminó durante el uso (401 definitivo). Un solo aviso. */
  const expireSession = useCallback(() => {
    clearSession('expired');
  }, [clearSession]);

  /** Refresh compartido (single-flight) con espejo del access token en estado. */
  const refreshAccessToken = useCallback(async (): Promise<RefreshOutcome> => {
    const outcome = await refreshSession();
    if (outcome.status === 'ok') setAccessTokenState(outcome.accessToken);
    return outcome;
  }, []);

  // El cliente HTTP habla con auth solo a través de este handler (sin ciclos).
  useEffect(() => {
    const handler: ApiAuthHandler = {
      getAccessToken,
      refreshAccessToken,
      onSessionExpired: expireSession,
    };
    setApiAuthHandler(handler);
    return () => setApiAuthHandler(null);
  }, [refreshAccessToken, expireSession]);

  // Bootstrap: sessionStorage -> refresh -> me -> sesión real.
  // El guard es un ref: en StrictMode el efecto corre dos veces y un cleanup
  // que cancelara el primer arranque dejaría la sesión cargando para siempre.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    async function bootstrap(): Promise<void> {
      if (!readRefreshToken()) {
        setStatus('anonymous');
        return;
      }

      const outcome = await refreshSession();

      if (outcome.status === 'expired') {
        clearSession(null);
        return;
      }
      if (outcome.status === 'unavailable') {
        setAccessTokenState(null);
        setStatus('anonymous');
        setBootstrapError(
          new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.'),
        );
        return;
      }

      setAccessTokenState(outcome.accessToken);
      try {
        const me = await fetchMe();
        if (!me.is_active) {
          clearSession('unavailable');
          return;
        }
        setIdentity(me);
        setStatus('authenticated');
        setBootstrapError(null);
      } catch (error) {
        const apiError = ApiError.from(error);
        if (apiError.status === 401 || apiError.status === 403) {
          clearSession('unavailable');
        } else if (apiError.code === 'NETWORK_ERROR') {
          // Red caída: el refresh token se conserva para el próximo intento.
          setAccessTokenState(null);
          setStatus('anonymous');
          setBootstrapError(apiError);
        } else {
          clearSession(null);
        }
      }
    }

    void bootstrap();
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setBootstrapError(null);
      setSessionNotice(null);
      try {
        const me = await loginWithCredentials(email, password);
        setIdentity(me);
        setAccessTokenState(getAccessToken());
        setStatus('authenticated');
      } catch (error) {
        clearSession(null);
        throw ApiError.from(error);
      }
    },
    [clearSession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRemote();
    } catch (error) {
      // El backend no confirmó el cierre (p. ej. 502): NO se afirma "sesión
      // cerrada". La sesión local queda intacta y la UI ofrece reintento.
      throw ApiError.from(error);
    }
    clearSession(null);
  }, [clearSession]);

  const endLocalSession = useCallback(() => {
    clearSession(null);
  }, [clearSession]);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  const value = useMemo<AuthContextValue>(() => {
    const user = identity ? toAuthUser(identity) : null;
    return {
      status,
      authenticated: status === 'authenticated' && user !== null,
      loading: status === 'loading',
      user,
      roles: user?.roles ?? [],
      permissions: identity?.permissions ?? [],
      accessToken,
      bootstrapError,
      sessionNotice,
      login,
      logout,
      endLocalSession,
      clearSessionNotice,
    };
  }, [
    status,
    identity,
    accessToken,
    bootstrapError,
    sessionNotice,
    login,
    logout,
    endLocalSession,
    clearSessionNotice,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
