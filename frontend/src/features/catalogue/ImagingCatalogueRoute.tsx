import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import ImagingCataloguePage from './ImagingCataloguePage';
import ImagingCatalogueMobilePage from './ImagingCataloguePage.mobile';

export default function ImagingCatalogueRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <ImagingCatalogueMobilePage /> : <ImagingCataloguePage />;
}
