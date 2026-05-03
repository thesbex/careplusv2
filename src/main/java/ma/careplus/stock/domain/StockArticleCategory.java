package ma.careplus.stock.domain;

/**
 * Category of a stock article.
 * MEDICAMENT_INTERNE → tracks_lots = true (lot + expiry required for IN movements).
 */
public enum StockArticleCategory {
    MEDICAMENT_INTERNE,
    DOSSIER_PHYSIQUE,
    CONSOMMABLE
}
