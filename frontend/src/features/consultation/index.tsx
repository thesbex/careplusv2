import { useParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import ConsultationPage from './ConsultationPage';
import ConsultationMobilePage from './ConsultationPage.mobile';
import ConsultationsListPage from './ConsultationsListPage';

/**
 * Responsive wrapper.
 * - Without :id  → list page (works for desktop + mobile, list is view-only).
 * - With    :id  → editor (desktop or mobile variant).
 */
export default function ConsultationRoute() {
  const { id } = useParams<{ id?: string }>();
  const isMobile = useIsMobile();
  if (!id) return <ConsultationsListPage />;
  return isMobile ? <ConsultationMobilePage /> : <ConsultationPage />;
}
