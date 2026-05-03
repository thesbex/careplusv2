import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import PatientsListPage from './PatientsListPage';
import PatientsListMobilePage from './PatientsListPage.mobile';

export default function PatientsListRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <PatientsListMobilePage /> : <PatientsListPage />;
}
