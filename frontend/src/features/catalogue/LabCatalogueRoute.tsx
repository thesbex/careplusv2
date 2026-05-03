import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import LabCataloguePage from './LabCataloguePage';
import LabCatalogueMobilePage from './LabCataloguePage.mobile';

export default function LabCatalogueRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <LabCatalogueMobilePage /> : <LabCataloguePage />;
}
