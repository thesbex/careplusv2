import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import PriseConstantesPage from './PriseConstantesPage';
import PriseConstantesMobilePage from './PriseConstantesPage.mobile';

/** Responsive wrapper — picks desktop or mobile Prise des constantes variant. */
export default function PriseConstantesRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <PriseConstantesMobilePage /> : <PriseConstantesPage />;
}
