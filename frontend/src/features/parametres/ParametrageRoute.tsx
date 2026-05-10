import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useAuthStore } from '@/lib/auth/authStore';
import ParametragePage from './ParametragePage';
import ParametrageMobilePage from './ParametragePage.mobile';

/**
 * Responsive wrapper for the "menu" tab.
 * The mobile variant is accessible to all roles (it's a profile/menu screen).
 * The desktop variant is admin-only — guard inside this wrapper rather than
 * at the route, so non-admins on mobile aren't redirected to /login.
 *
 * `?desktop=1` lets ADMIN/MEDECIN force the desktop layout from a mobile
 * viewport (cabinet config, tariffs, users — admin tasks the mobile menu
 * doesn't expose).
 */
export default function ParametrageRoute() {
  const [params] = useSearchParams();
  const forceDesktop = params.get('desktop') === '1';
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const isAdminOrDoctor =
    !!user && (user.roles.includes('ADMIN') || user.roles.includes('MEDECIN'));

  if (forceDesktop && isAdminOrDoctor) return <ParametragePage />;
  if (isMobile) return <ParametrageMobilePage />;
  if (!isAdminOrDoctor) {
    // Desktop fallback for non-admins: render the mobile menu (works at any width).
    return <ParametrageMobilePage />;
  }
  return <ParametragePage />;
}
