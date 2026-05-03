import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import FacturationPage from './FacturationPage';
import FacturationMobilePage from './FacturationPage.mobile';

export default function FacturationRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <FacturationMobilePage /> : <FacturationPage />;
}
