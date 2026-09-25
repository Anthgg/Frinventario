import { apiClient } from './client';
import type {
  LoginResponse,
  LogoutResponse,
  MeResponse,
  RefreshResponse,
} from '@/types/auth';

/**
 * Endpoints de autenticación — contrato real (app/api/auth.py):
 *   POST /api/v1/auth/login    { email, password } -> session + user
 *   POST /api/v1/auth/refresh  { refresh_token }    -> session
 *   POST /api/v1/auth/logout   bearer               -> { status }
 *   GET  /api/v1/auth/me       bearer               -> user + permissions
 */
export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),

  refresh: (refreshToken: string): Promise<RefreshResponse> =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: (): Promise<LogoutResponse> => apiClient.post<LogoutResponse>('/auth/logout'),

  me: (): Promise<MeResponse> => apiClient.get<MeResponse>('/auth/me'),
};
