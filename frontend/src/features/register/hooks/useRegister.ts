import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLogin } from '@/lib/auth/useAuth';

interface BootstrapPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface BootstrapResponse {
  id: string;
  email: string;
  roles: string[];
}

/**
 * Creates the very first ADMIN account on a fresh install via
 * POST /api/admin/bootstrap, then immediately logs in with the same
 * credentials so the caller can navigate straight into /onboarding
 * with a live session.
 *
 * The bootstrap endpoint 409s once the database has any user, which
 * surfaces here as a useMutation error — the page should redirect to
 * /login in that case (the install has already been claimed).
 */
export function useRegister() {
  const login = useLogin();
  return useMutation({
    mutationFn: async (payload: BootstrapPayload) => {
      await api.post<BootstrapResponse>('/admin/bootstrap', payload);
      // Auto-login so the new admin has a fresh access token + refresh cookie.
      await login.mutateAsync({ email: payload.email, password: payload.password });
    },
  });
}
