/**
 * Responsive entry point for /stock.
 * Desktop → StockArticlesPage
 * Mobile  → StockArticlesPage.mobile
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import StockArticlesPageDesktop from './StockArticlesPage';
import StockArticlesPageMobile from './StockArticlesPage.mobile';

export default function StockArticlesRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <StockArticlesPageMobile />;
  return <StockArticlesPageDesktop />;
}
