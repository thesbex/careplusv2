/**
 * Responsive entry point for /dashboard.
 * Desktop → DashboardPage
 * Mobile  → DashboardPage.mobile
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import DashboardPageDesktop from './DashboardPage';
import DashboardPageMobile from './DashboardPage.mobile';

export default function DashboardRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <DashboardPageMobile />;
  return <DashboardPageDesktop />;
}
