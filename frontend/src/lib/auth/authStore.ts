import { create } from 'zustand';

/**
 * Global auth state — **access token only**, in memory, never persisted.
 * Refresh token lives in an HttpOnly `careplus_refresh` cookie set by the
 * backend (ADR-019). A page refresh loses `accessToken`; the app recovers
 * it by calling `/api/auth/refresh` on boot via `useBootstrapAuth`.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
  isAuthenticated: () => !!get().accessToken,
  hasRole: (role: string) => get().user?.roles.includes(role) ?? false,
}));
