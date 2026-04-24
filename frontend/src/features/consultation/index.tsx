import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import ConsultationPage from './ConsultationPage';
import ConsultationMobilePage from './ConsultationPage.mobile';

/** Responsive wrapper — picks desktop or mobile Consultation variant. */
export default function ConsultationRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <ConsultationMobilePage /> : <ConsultationPage />;
}
