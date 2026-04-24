import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import DossierPage from './DossierPage';
import DossierMobilePage from './DossierPage.mobile';

/** Responsive wrapper — picks desktop or mobile Dossier patient variant. */
export default function DossierRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <DossierMobilePage /> : <DossierPage />;
}
