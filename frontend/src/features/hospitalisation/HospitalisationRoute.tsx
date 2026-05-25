/**
 * Point d'entrée responsive pour /hospitalisation.
 * Desktop → HospitalisationPage ; Mobile → HospitalisationPage.mobile.
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import HospitalisationPageDesktop from './HospitalisationPage';
import HospitalisationPageMobile from './HospitalisationPage.mobile';

export default function HospitalisationRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <HospitalisationPageMobile />;
  return <HospitalisationPageDesktop />;
}
