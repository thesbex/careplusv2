-- =============================================================================
-- V066 — Correctif FK : hospitalization_stay_prestation.act_id
--
-- BUG : le menu déroulant « Acte du catalogue » du panneau prestations de séjour
-- charge /api/catalog/prestations (table `catalog_prestation`, V016), mais la
-- colonne act_id pointait par erreur vers `catalog_act(id)` (V060). Choisir un
-- acte du catalogue envoyait un id `catalog_prestation` → violation de la
-- contrainte FK → 500 INTERNAL à l'ajout de prestation pour un patient admis.
--
-- Correctif : repointer la FK vers `catalog_prestation(id)`. Aucune donnée à
-- migrer (la saisie libre laisse act_id NULL ; les liens cassés n'ont jamais pu
-- être persistés à cause de la contrainte).
-- =============================================================================

-- Drop de l'ancienne contrainte (nom auto Postgres ; tolérant si absent).
ALTER TABLE hospitalization_stay_prestation
    DROP CONSTRAINT IF EXISTS hospitalization_stay_prestation_act_id_fkey;

-- Filet de sécurité : si la contrainte a un nom non standard, on la retrouve et on la supprime.
DO $$
DECLARE
    cname text;
BEGIN
    FOR cname IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'hospitalization_stay_prestation'
          AND kcu.column_name = 'act_id'
    LOOP
        EXECUTE format('ALTER TABLE hospitalization_stay_prestation DROP CONSTRAINT %I', cname);
    END LOOP;
END $$;

-- Nouvelle contrainte vers le bon catalogue.
ALTER TABLE hospitalization_stay_prestation
    ADD CONSTRAINT hospitalization_stay_prestation_act_id_fkey
    FOREIGN KEY (act_id) REFERENCES catalog_prestation(id);
