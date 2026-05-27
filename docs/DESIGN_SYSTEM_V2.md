# careplus — Design System v2 (DS2)

**Statut** : pilote (2026-05-27). Appliqué à **Dashboard** + **navbar (sidebar)**. Le reste des écrans suivra une fois la direction validée.
**Source** : maquette dashboard fournie par le client — fond bleu-gris frais, cartes douces ombrées, accent **navy**, graphes navy (recharts), KPI à **pastille + delta coloré**, listes **numérotées**.

## Où c'est défini

- **Tokens** : `frontend/src/styles/design-system-v2.css` — variables `--ds2-*`, globales, importées dans `main.tsx`. Elles **n'écrasent pas** les tokens historiques (`--bg`, `--primary`, …) : on migre écran par écran.
- **Dashboard** : `frontend/src/features/dashboard/DashboardPage.tsx` + `dashboard.css` (scope `.dx`, qui réfère `var(--ds2-*)`).
- **Navbar** : `frontend/src/styles/shell.css` (`.cp-sidebar`, `.cp-nav-item`, …) référence `var(--ds2-*)`.

## Palette

| Rôle | Token | Valeur |
|---|---|---|
| Fond espace de travail | `--ds2-bg` | `#f3f6fc` (bleu-gris frais) |
| Surface (cartes, sidebar) | `--ds2-surface` | `#ffffff` |
| Hover doux / lignes | `--ds2-surface-2` | `#f8fafd` |
| Hairline | `--ds2-border` | `#e7ecf3` |
| Encre titres / gros chiffres | `--ds2-ink` | `#0f172a` |
| Encre libellés / corps | `--ds2-ink-2` | `#475467` |
| Encre secondaire | `--ds2-ink-3` | `#8a94a6` |
| Primary / graphes / actif | `--ds2-navy` | `#1e3a8a` |
| Fond état actif | `--ds2-navy-soft` | `#e6ecf8` |
| Barres inactives (graphes) | `--ds2-navy-chart-soft` | `#dde4f3` |
| Pastille bleue | `--ds2-blue` | `#2563eb` |
| Pastille indigo | `--ds2-indigo` | `#4f46e5` |
| Positif (delta) | `--ds2-green` | `#16a34a` |
| Attention (delta) | `--ds2-amber` | `#ea580c` |
| Négatif (delta) | `--ds2-danger` | `#dc2626` |

## Élévation & rayons

- Ombre carte : `--ds2-shadow-sm` = `0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)`
- Rayon carte : `--ds2-radius` = `14px` ; petit (nav, chips) : `--ds2-radius-sm` = `9px`
- Typo : police inchangée (Plus Jakarta Sans). Gros chiffres `700`, `letter-spacing:-0.02em`, `tabular-nums`.

## Composants (patterns de référence)

- **KPI card** (`.dx-kpi`) : `pastille colorée + libellé (sentence-case)` en tête → `gros chiffre (+ unité grise)` → `delta coloré` (vert/orange/rouge/gris). Variante `is-accent` = barre navy en haut (carte « primaire »).
- **Card** (`.dx-card`) : titre `700` + sous-titre `ink-3` ; slot `right` pour un gros chiffre + tendance (`↑8,2%`).
- **Graphes** (recharts) : aire `monotone` navy + dégradé pour les tendances ; barres navy (récentes/pic) vs `navy-chart-soft` (inactives), `radius [3,3,0,0]`, axes sans ligne, ticks `10px ink-3`.
- **Liste numérotée** (`.dx-rank`) : `01 · libellé · valeur · %`, séparateurs hairline.
- **Navbar** : surface blanche, item actif = fond `navy-soft` + texte navy + **accent latéral navy 3px** ; badge navy.

## Déploiement

1. ✅ Dashboard + navbar (pilote).
2. À faire : porter écran par écran (Patients, Agenda, Salle, Facturation, …) en passant les surfaces/bordures/encres aux `--ds2-*` et en réutilisant les patterns ci-dessus.
3. Quand tous les écrans sont migrés : **promouvoir** les valeurs `--ds2-*` dans `:root` de `tokens.css`, remplacer les anciens tokens, retirer le scope `.dx`.
