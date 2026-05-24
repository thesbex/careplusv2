import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { router } from '../routes';
import { RequireAuth, RequireRole } from '@/lib/auth/RequireAuth';

/**
 * Regression guard for the mobile "Plus" menu hub.
 *
 * /parametres is the mobile menu/profile hub reached by the "Plus" tab and is
 * needed by ALL roles (ParametrageRoute gates the admin-only desktop settings
 * internally). It was once wrapped in `RequireRole roles={['ADMIN']}`, which
 * bounced every non-admin to /agenda and made every Plus-menu module
 * (dashboard, consultations, vaccinations, grossesses, stock, messages,
 * catalogue, profil) unreachable on mobile.
 *
 * This test locks the route-level guard to RequireAuth so the regression can't
 * silently return.
 */
type AnyRoute = {
  path?: string;
  element?: ReactElement;
  children?: AnyRoute[];
};

function findRoute(routes: AnyRoute[], path: string): AnyRoute | undefined {
  for (const r of routes) {
    if (r.path === path) return r;
    if (r.children) {
      const hit = findRoute(r.children, path);
      if (hit) return hit;
    }
  }
  return undefined;
}

describe('routes guard — /parametres', () => {
  it('guards /parametres with RequireAuth (all roles), not RequireRole ADMIN', () => {
    const route = findRoute(router.routes as AnyRoute[], '/parametres');
    expect(route).toBeDefined();
    expect(route!.element?.type).toBe(RequireAuth);
    expect(route!.element?.type).not.toBe(RequireRole);
  });
});
