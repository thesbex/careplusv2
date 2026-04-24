import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import SalleAttentePage from './SalleAttentePage';
import SalleAttenteMobilePage from './SalleAttentePage.mobile';

/** Responsive wrapper — picks desktop or mobile Salle d'attente variant. */
export default function SalleAttenteRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <SalleAttenteMobilePage /> : <SalleAttentePage />;
}
