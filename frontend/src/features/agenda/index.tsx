import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import AgendaPage from './AgendaPage';
import AgendaMobilePage from './AgendaPage.mobile';

/** Responsive wrapper — picks desktop or mobile Agenda variant. */
export default function AgendaRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <AgendaMobilePage /> : <AgendaPage />;
}
