/**
 * Axios instance for careplus backend calls.
 *
 * ADR-019: access token lives in memory (Zustand auth store), refresh token
 * lives in an HttpOnly cookie (`careplus_refresh`) the browser attaches
 * automatically because of `withCredentials: true`.
 *
 * Interceptor chain:
 *   request  → attach `Authorization: Bearer <accessToken>` if present
 *   response → on 401, call /api/auth/refresh once, then retry the original
 *              request; if refresh itself fails, clear auth + surface the error.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/lib/auth/authStore';

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the HttpOnly careplus_refresh cookie
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// ── Request interceptor ─────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── Response interceptor: refresh-on-401 + retry (single attempt) ──
interface RetryableRequest extends AxiosRequestConfig {
  _careplusRetried?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  // Fire at most one /refresh call at a time; other failed requests await this promise.
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<{ accessToken: string; expiresInSeconds: number }>(
        '/api/auth/refresh',
        null,
        { withCredentials: true },
      )
      .then((res) => {
        const token = res.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        return token;
      })
      .catch(() => {
        useAuthStore.getState().clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequest | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._careplusRetried &&
      original.url !== '/auth/refresh' &&
      original.url !== '/auth/login'
    ) {
      original._careplusRetried = true;
      const newToken = await performRefresh();
      if (newToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }

    return Promise.reject(error);
  },
);
