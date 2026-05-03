-- V023: indexes pour les filtres avancés sur factures + export.
-- Existants couverts par V001 :
--   idx_invoice_patient   (patient_id)
--   idx_invoice_status    (status)
--   idx_invoice_issued    (issued_at DESC)
--   idx_payment_invoice   (invoice_id)
--   idx_payment_time      (received_at DESC)
-- Ce qui manquait :
--   - filtre amountMin/Max sur net_amount (colonne ajoutée en V005, pas indexée)
--   - filtre paymentMode multi : EXISTS (… WHERE invoice_id=? AND method IN (…))
--     → composite (invoice_id, method) plus tight que idx_payment_invoice seul.

CREATE INDEX IF NOT EXISTS idx_invoice_net_amount
    ON billing_invoice (net_amount);

CREATE INDEX IF NOT EXISTS idx_payment_invoice_method
    ON billing_payment (invoice_id, method);
