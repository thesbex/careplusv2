/**
 * Responsive entry point for /grossesses.
 * Desktop → PregnancesQueuePage
 * Mobile  → PregnancesQueuePage.mobile
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import PregnancesQueuePageDesktop from './PregnancesQueuePage';
import PregnancesQueuePageMobile from './PregnancesQueuePage.mobile';

export default function PregnancesQueueRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <PregnancesQueuePageMobile />;
  return <PregnancesQueuePageDesktop />;
}
