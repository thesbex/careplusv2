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
  /** AuthUser shape — V044 adds `passwordChangeRequired`. */
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * sessionStorage flag set by `performLogout` so the very next
 * `useBootstrapAuth` skips its silent `/auth/refresh` attempt — otherwise the
 * still-valid `careplus_refresh` cookie (the keepalive logout may not have
 * landed yet on a sleeping backend) would auto-relog the user back in.
 * Per-tab + consumed on read.
 */
const SUPPRESS_BOOTSTRAP_FLAG = 'careplus.suppressBootstrap';

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
 * Imperative logout used by sidebar / mobile menu buttons.
 *
 * We do NOT await the server call: on Render free tier the backend may be
 * asleep, and `await api.post('/auth/logout')` then blocks the click handler
 * for 30+ s while the user stares at a frozen "Déconnexion…" button. Instead
 * we fire the request with `keepalive: true` (the browser is allowed to
 * complete it past the navigation), clear local state, raise the
 * suppress-bootstrap flag, and hard-redirect immediately.
 *
 * The cookie carries the refresh token and is sent same-origin automatically.
 */
export function performLogout(): void {
  try {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sendBeacon-style fire-and-forget — any throw here is non-fatal.
  }
  try {
    sessionStorage.setItem(SUPPRESS_BOOTSTRAP_FLAG, '1');
  } catch {
    // sessionStorage may throw in privacy modes — accept the rare auto-relogin.
  }
  useAuthStore.getState().clear();
  window.location.href = '/login';
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
    // Skip the silent refresh right after a logout — the `careplus_refresh`
    // cookie might still be valid server-side (the keepalive POST hasn't
    // landed yet on a slow backend), in which case refreshing would silently
    // sign the user back in.
    let suppressed = false;
    try {
      if (sessionStorage.getItem(SUPPRESS_BOOTSTRAP_FLAG) === '1') {
        sessionStorage.removeItem(SUPPRESS_BOOTSTRAP_FLAG);
        suppressed = true;
      }
    } catch {
      // sessionStorage unavailable — fall through to the normal refresh path.
    }
    if (suppressed) {
      setReady(true);
      return;
    }
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
