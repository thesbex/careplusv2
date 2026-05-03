/**
 * Responsive entry point for /vaccinations.
 * Desktop → VaccinationsQueuePage
 * Mobile  → VaccinationsQueuePage.mobile
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import VaccinationsQueuePageDesktop from './VaccinationsQueuePage';
import VaccinationsQueuePageMobile from './VaccinationsQueuePage.mobile';

export default function VaccinationsQueueRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <VaccinationsQueuePageMobile />;
  return <VaccinationsQueuePageDesktop />;
}
