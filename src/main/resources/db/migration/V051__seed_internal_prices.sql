-- =============================================================================
-- Seed des prix internes par défaut (Suivi CarePlus, qualif « NOT SHIPPED »
-- sur « facturation interne radio/analyses » — 2026-05-23).
--
-- V050 a livré le champ + la logique de facturation, mais le catalogue partait
-- en prod sans aucun prix interne renseigné → BillingService skip les lignes,
-- le médecin voit "rien ne change quand je coche en interne". Du point de vue
-- utilisateur, c'est NOT SHIPPED.
--
-- Cette migration set des valeurs initiales raisonnables par catégorie / modalité
-- pour que la feature fonctionne dès le 1er démarrage. Le cabinet peut ensuite
-- ajuster ligne par ligne via Catalogue → Modifier.
--
-- WHERE internal_price IS NULL → idempotent et sans écraser les prix déjà fixés
-- par les utilisateurs en environnement déjà migré.
-- =============================================================================

-- Analyses biologiques (MAD) — prix médians cabinet privé Casablanca 2026.
UPDATE catalog_lab_test SET internal_price = CASE category
    WHEN 'diabete'        THEN  35
    WHEN 'lipides'        THEN 150
    WHEN 'hematologie'    THEN  80
    WHEN 'biochimie'      THEN  60
    WHEN 'foie'           THEN 120
    WHEN 'rein'           THEN  55
    WHEN 'thyroide'       THEN 130
    WHEN 'endocrino'      THEN 140
    WHEN 'endocrinologie' THEN 140
    WHEN 'inflammation'   THEN  70
    WHEN 'cardiaque'      THEN 180
    WHEN 'coagulation'    THEN  95
    WHEN 'urines'         THEN  90
    WHEN 'bacteriologie'  THEN 110
    WHEN 'parasitologie'  THEN 100
    WHEN 'serologie'      THEN 160
    WHEN 'allergologie'   THEN 200
    WHEN 'oncologie'      THEN 220
    WHEN 'vitamines'      THEN 170
    WHEN 'gynecologie'    THEN 150
    WHEN 'pancreas'       THEN  85
    WHEN 'bio'            THEN  60
    ELSE                        80
END
WHERE internal_price IS NULL;

-- Imagerie médicale (MAD) — prix médians cabinet privé Casablanca 2026.
UPDATE catalog_imaging_exam SET internal_price = CASE modality
    WHEN 'ECHO'               THEN 250
    WHEN 'RADIO'              THEN 150
    WHEN 'MAMMO'              THEN 350
    WHEN 'SCANNER'            THEN 900
    WHEN 'IRM'                THEN 1800
    WHEN 'ENDOSCOPIE'         THEN 1200
    WHEN 'MEDECINE_NUCLEAIRE' THEN 1500
    ELSE                            250
END
WHERE internal_price IS NULL;
