/**
 * Responsive entry point for /stock/articles/:id.
 * Desktop → StockArticleDetailPage
 * Mobile  → StockArticleDetailPage.mobile
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import StockArticleDetailPageDesktop from './StockArticleDetailPage';
import StockArticleDetailPageMobile from './StockArticleDetailPage.mobile';

export default function StockArticleDetailRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <StockArticleDetailPageMobile />;
  return <StockArticleDetailPageDesktop />;
}
