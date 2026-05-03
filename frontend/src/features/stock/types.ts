/**
 * TypeScript types for the Stock interne module.
 * Mirrors backend DTOs from StockArticleView, StockLot, StockMovement,
 * StockSupplier, StockAlertCount.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type StockArticleCategory =
  | 'MEDICAMENT_INTERNE'
  | 'DOSSIER_PHYSIQUE'
  | 'CONSOMMABLE';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export type StockLotStatus = 'ACTIVE' | 'EXHAUSTED' | 'INACTIVE';

// ── Backend DTOs ───────────────────────────────────────────────────────────

/** Mirrors backend StockSupplierDto */
export interface StockSupplier {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
}

/** Mirrors backend StockArticleView (list item) */
export interface StockArticle {
  id: string;
  code: string;
  label: string;
  category: StockArticleCategory;
  unit: string;
  minThreshold: number;
  supplierId: string | null;
  supplierName: string | null;
  location: string | null;
  active: boolean;
  tracksLots: boolean;
  /** Calculated: current available quantity */
  currentQuantity: number;
  /** Nearest expiry date (ISO date) — only for MEDICAMENT_INTERNE */
  nearestExpiry: string | null;
}

/** Mirrors backend StockLotDto */
export interface StockLot {
  id: string;
  articleId: string;
  lotNumber: string;
  expiresOn: string; // ISO date
  quantity: number;
  status: StockLotStatus;
}

/** Mirrors backend StockMovementDto */
export interface StockMovement {
  id: string;
  articleId: string;
  lotId: string | null;
  lotNumber: string | null;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  performedBy: {
    id: string;
    name: string;
  };
  performedAt: string; // ISO datetime
}

/** Mirrors backend StockAlertCount */
export interface StockAlertCount {
  lowStock: number;
  expiringSoon: number;
}

/** Mirrors backend StockAlertsView */
export interface StockAlertsView {
  lowStockArticles: StockArticle[];
  expiringSoonLots: StockLot[];
}

// ── Paginated responses ────────────────────────────────────────────────────

export interface PageView<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<StockArticleCategory, string> = {
  MEDICAMENT_INTERNE: 'Médicament',
  DOSSIER_PHYSIQUE: 'Dossier physique',
  CONSOMMABLE: 'Consommable',
};

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  ADJUSTMENT: 'Ajustement',
};
