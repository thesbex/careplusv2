/**
 * Point d'entrée responsive pour /charges.
 * Desktop → ChargesPage ; Mobile → ChargesPage.mobile.
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import ChargesPageDesktop from './ChargesPage';
import ChargesPageMobile from './ChargesPage.mobile';

export default function ChargesRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <ChargesPageMobile />;
  return <ChargesPageDesktop />;
}
