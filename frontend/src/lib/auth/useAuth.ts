import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore, type AuthUser } from './authStore';

interface LoginBody {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * POST /api/auth/login — mirrors the backend DTO (ADR-019): access token in
 * body, refresh in HttpOnly cookie set server-side. `withCredentials: true`
 * in the axios client makes the browser attach the cookie on subsequent calls.
 */
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (body: LoginBody) => {
      const res = await api.post<LoginResponse>('/auth/login', body);
      return res.data;
    },
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      // Always clear local state, even if the server errored.
      clear();
    },
  });
}

/**
 * On app boot, try once to exchange the HttpOnly refresh cookie for an
 * access token + user. If the user isn't logged in, the refresh call 401s
 * and we stay logged out. No user-visible error either way.
 */
export function useBootstrapAuth(): { ready: boolean } {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refresh = await api.post<RefreshResponse>('/auth/refresh');
        if (cancelled) return;
        setAccessToken(refresh.data.accessToken);
        // After refresh succeeds, fetch the current user profile so the
        // sidebar / guards know who we are.
        const me = await api.get<AuthUser>('/users/me');
        if (cancelled) return;
        setSession(refresh.data.accessToken, me.data);
      } catch {
        // Not logged in — normal path, swallow.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAccessToken, setSession]);

  return { ready };
}
