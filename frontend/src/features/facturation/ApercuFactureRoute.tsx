import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import ApercuFacturePage from './ApercuFacturePage';
import ApercuFactureMobilePage from './ApercuFacturePage.mobile';

export default function ApercuFactureRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <ApercuFactureMobilePage /> : <ApercuFacturePage />;
}
