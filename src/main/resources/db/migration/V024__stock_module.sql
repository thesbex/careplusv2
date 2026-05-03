-- V024 — Stock interne module schema
-- 4 new tables: stock_supplier, stock_article, stock_lot, stock_movement
-- Conventions: UUID PK, TIMESTAMPTZ, audit cols, optimistic locking on mutable aggregates
-- stock_movement is immutable (no soft-delete, no updated_at trigger)

-- =============================================================================
-- stock_supplier — fournisseurs (éditable Paramétrage)
-- =============================================================================
CREATE TABLE stock_supplier (
    id         UUID         PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    phone      VARCHAR(50),
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    version    BIGINT       NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

CREATE TRIGGER trg_stock_supplier_touch
    BEFORE UPDATE ON stock_supplier
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- stock_article — référentiel articles (éditable Paramétrage)
-- category enum: MEDICAMENT_INTERNE | DOSSIER_PHYSIQUE | CONSOMMABLE
-- tracks_lots is a GENERATED column: true only for MEDICAMENT_INTERNE
-- =============================================================================
CREATE TABLE stock_article (
    id            UUID         PRIMARY KEY,
    code          VARCHAR(64)  NOT NULL UNIQUE,
    label         VARCHAR(200) NOT NULL,
    category      VARCHAR(32)  NOT NULL
                  CHECK (category IN ('MEDICAMENT_INTERNE', 'DOSSIER_PHYSIQUE', 'CONSOMMABLE')),
    unit          VARCHAR(32)  NOT NULL,
    min_threshold INT          NOT NULL DEFAULT 0,
    supplier_id   UUID         REFERENCES stock_supplier(id),
    location      VARCHAR(200),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    tracks_lots   BOOLEAN      GENERATED ALWAYS AS (category = 'MEDICAMENT_INTERNE') STORED,
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID,
    updated_by    UUID
);

CREATE INDEX idx_stock_article_category_active ON stock_article (category, active);
CREATE INDEX idx_stock_article_code            ON stock_article (code);

CREATE TRIGGER trg_stock_article_touch
    BEFORE UPDATE ON stock_article
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- stock_lot — lots actifs et historiques (uniquement MEDICAMENT_INTERNE)
-- status enum: ACTIVE | EXHAUSTED | INACTIVE
-- =============================================================================
CREATE TABLE stock_lot (
    id          UUID         PRIMARY KEY,
    article_id  UUID         NOT NULL REFERENCES stock_article(id),
    lot_number  VARCHAR(100) NOT NULL,
    expires_on  DATE         NOT NULL,
    quantity    INT          NOT NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'INACTIVE')),
    version     BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  UUID,
    updated_by  UUID,
    UNIQUE (article_id, lot_number)
);

CREATE INDEX idx_stock_lot_article_status_expiry ON stock_lot (article_id, status, expires_on);

CREATE TRIGGER trg_stock_lot_touch
    BEFORE UPDATE ON stock_lot
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- stock_movement — historique de tous les mouvements (immutable, jamais soft-delete)
-- type enum: IN | OUT | ADJUSTMENT
-- quantity always positive; sign is carried by type
-- =============================================================================
CREATE TABLE stock_movement (
    id           UUID         PRIMARY KEY,
    article_id   UUID         NOT NULL REFERENCES stock_article(id),
    lot_id       UUID         REFERENCES stock_lot(id),
    type         VARCHAR(16)  NOT NULL
                 CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity     INT          NOT NULL CHECK (quantity > 0),
    reason       VARCHAR(500),
    performed_by UUID         NOT NULL REFERENCES identity_user(id),
    performed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movement_article_performed ON stock_movement (article_id, performed_at DESC);
