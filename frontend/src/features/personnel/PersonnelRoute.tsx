/**
 * Point d'entrée responsive pour /personnel.
 * Desktop → PersonnelPage ; Mobile → PersonnelPage.mobile.
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import PersonnelPageDesktop from './PersonnelPage';
import PersonnelPageMobile from './PersonnelPage.mobile';

export default function PersonnelRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <PersonnelPageMobile />;
  return <PersonnelPageDesktop />;
}
