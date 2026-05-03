// ── Hooks ────────────────────────────────────────────────────────────────────
export { useStockArticles } from './hooks/useStockArticles';
export { useStockArticle } from './hooks/useStockArticle';
export { useStockMovements } from './hooks/useStockMovements';
export { useStockLots } from './hooks/useStockLots';
export { useStockAlertsCount } from './hooks/useStockAlertsCount';
export { useStockAlerts } from './hooks/useStockAlerts';
export { useStockSuppliers } from './hooks/useStockSuppliers';
export { useUpsertArticle } from './hooks/useUpsertArticle';
export { useDeactivateArticle } from './hooks/useDeactivateArticle';
export { useRecordMovement } from './hooks/useRecordMovement';
export { useInactivateLot } from './hooks/useInactivateLot';

// ── Components ───────────────────────────────────────────────────────────────
export { MovementDrawer } from './components/MovementDrawer';
export { MovementDrawerMobile } from './components/MovementDrawer.mobile';
export { StockArticleFormDrawer } from './components/StockArticleFormDrawer';
export { LotInactivateDialog } from './components/LotInactivateDialog';

// ── Pages ────────────────────────────────────────────────────────────────────
export { default as StockArticlesRoute } from './StockArticlesRoute';
export { default as StockArticleDetailRoute } from './StockArticleDetailRoute';

// ── Types & schemas ──────────────────────────────────────────────────────────
export type {
  StockArticleCategory,
  StockMovementType,
  StockLotStatus,
  StockSupplier,
  StockArticle,
  StockLot,
  StockMovement,
  StockAlertCount,
  StockAlertsView,
  PageView,
} from './types';
export { CATEGORY_LABEL, MOVEMENT_TYPE_LABEL } from './types';

export { MovementSchema, UpsertArticleSchema, UpsertSupplierSchema } from './schemas';
export type { MovementValues, UpsertArticleValues, UpsertSupplierValues } from './schemas';
export type { StockArticlesFilters } from './hooks/useStockArticles';
export type { StockMovementsFilters } from './hooks/useStockMovements';
export type { UpsertArticleBody } from './hooks/useUpsertArticle';
export type { RecordMovementBody } from './hooks/useRecordMovement';
