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

## 2026-05-31 — Agenda « Calm Premium » : skin v1 (couleurs/cartes) vs rail droit + légende-carte

**Maquette** : `careplus refresh - agenda (calm premium).html` (lien Claude Design
`bTnkKgHLzC1JWynVjC2JEg`). Refonte de l'agenda en langage Calm Premium : canvas
porcelaine, accent thème (mauve par défaut), cartes RDV `accent-soft` + bord-gauche
3px + ombre douce (sans hairline), calendrier en carte borderless flottante, légende
enclose, et un **rail droit** à 3 cartes : « Aujourd'hui » (compteur + répartition
par statut + barre de remplissage), « Prochains RDV », « Salle d'attente » (carte
accent pleine).

**App (porté en v1, agenda.css)** : cartes RDV sans bordure dure (bord-gauche accent
+ ombre douce, radius 8) ; confirmé/planifié en `--ds2-navy-soft` (suit l'accent, plus
le saphir figé `#F4F7FC`) ; voile du jour + lane médecin + pause déjeuner + weekend mois
en teintes chaudes accent/porcelaine (plus de `rgba(30,77,171,…)` ni `#EEF2F8`) ;
calendrier + légende basse en cartes douces borderless.

**Écart assumé (non porté en v1)** :
1. **Rail droit « stats du jour »** (compteur + répartition statuts + barre de
   remplissage + « Prochains RDV » + carte accent « Salle d'attente »). L'app garde
   son panneau `TodayArrivals` (arrivées RÉELLES de la file) comme source de vérité ;
   remplacer = nouveau composant + câblage data (capacité/taux de remplissage non
   dispo en l'état). À rouvrir si on veut le tableau de bord latéral.
2. **Coloration par TYPE vs par STATUT** : le mock colore les RDV par type
   (consultation/suivi/urgence/acte). L'app colore par **statut** (confirmé/arrivé/
   en cours/terminé/retard) — choix fonctionnel plus riche (la secrétaire voit qui est
   arrivé / en cours / en retard d'un coup d'œil). On garde le statut, habillé Calm
   Premium. Décision figée.
3. **Ligne d'heure 56 px** (mock) vs **104 px** (app, bump délibéré pour l'air des
   cartes, cf. fixtures.ts). Conservé à 104.
