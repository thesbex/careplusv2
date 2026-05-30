# Frontend design gaps

Différences assumées entre `design/` (prototypes Claude Design) et l'app, avec la
raison. À traiter ou à fermer explicitement — pas de dérive silencieuse (CLAUDE.md règle 10).

## 2026-05-30 — Chambres & lits « Calm Premium » : navigation mobile (`.m-secnav`)

**Maquette** : `careplus refresh - chambres & lits (calm premium).html` — le cadre
mobile remplace la barre d'onglets par un **stepper de section** (`.m-secnav` :
flèches précédent/suivant + « Paramètres · 04 / 07 » + titre, et `.m-secdots`
points de progression).

**App** : sur mobile, l'écran Chambres & lits est atteint via le hub Paramètres qui
force la variante desktop (`/parametres?desktop=1`, barre d'onglets). Le **contenu**
de l'écran est iso (mêmes styles `.cl-*`, responsive à 390 px). Seule la **chrome de
navigation** diffère.

**Décision** : non porté dans cette passe. Le `.m-secnav` est un patron de navigation
de la SECTION Paramètres entière (les 7 sous-écrans), pas du contenu Chambres & lits ;
le porter = re-architecturer la nav des paramètres sur mobile (impacte tous les
onglets + les tests de nav mobile existants). Hors périmètre « rendre l'écran iso ».
À rouvrir si on décide d'adopter le stepper pour toute la section Paramètres mobile.
