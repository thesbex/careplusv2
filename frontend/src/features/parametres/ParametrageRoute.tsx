import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useAuthStore } from '@/lib/auth/authStore';
import ParametragePage from './ParametragePage';
import ParametrageMobilePage from './ParametragePage.mobile';

/**
 * Responsive wrapper for the "menu" tab.
 * The mobile variant is accessible to all roles (it's a profile/menu screen).
 * The desktop variant is admin-only — guard inside this wrapper rather than
 * at the route, so non-admins on mobile aren't redirected to /login.
 */
export default function ParametrageRoute() {
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const isAdminOrDoctor =
    !!user && (user.roles.includes('ADMIN') || user.roles.includes('MEDECIN'));

  if (isMobile) return <ParametrageMobilePage />;
  if (!isAdminOrDoctor) {
    // Desktop fallback for non-admins: render the mobile menu (works at any width).
    return <ParametrageMobilePage />;
  }
  return <ParametragePage />;
}
