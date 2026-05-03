import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import OrdonnancePdfPage from './OrdonnancePdfPage';
import OrdonnancePdfMobilePage from './OrdonnancePdfPage.mobile';

export default function OrdonnancePdfRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <OrdonnancePdfMobilePage /> : <OrdonnancePdfPage />;
}
