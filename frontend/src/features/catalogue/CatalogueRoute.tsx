import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import CataloguePage from './CataloguePage';
import CatalogueMobilePage from './CataloguePage.mobile';

export default function CatalogueRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <CatalogueMobilePage /> : <CataloguePage />;
}
