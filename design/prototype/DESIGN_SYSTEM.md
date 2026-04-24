# careplus — Design System

Medical practice software for Moroccan clinics. Clinical, calm, professional. No AI-slop gradients, no playful iconography. Everything serves the medical workflow.

**Stack**: React 18 + Babel inline JSX, CSS custom properties, `design_canvas` starter for artboard layout.

---

## 1. Design principles

1. **Clinical trust over delight.** Color is muted, type is utilitarian, spacing is dense. A doctor reads this 60× per day — respect their attention.
2. **Dense but scannable.** Desktop is information-heavy (≤13px base); mobile opens up (14–15px) because thumbs need space.
3. **Status is color-coded, never icon-only.** Every patient state has a dedicated pill color (arrived/waiting/vitals/consult/done) so a glance across the salle d'attente is enough.
4. **Serif is sacred.** `Instrument Serif` appears **only** on printed A4 documents (ordonnance, facture). Never in UI chrome.
5. **Tabular numerics everywhere.** Times, weights, TA readings, prices — always `font-variant-numeric: tnum` + `ss01`.
6. **French UI, Moroccan context.** CIN, ICE, MAD, INPE, Casablanca addresses. No Anglicisms.

---

## 2. Color tokens

All colors are CSS custom properties defined in `styles.css:5–44`. Use variables — never hardcode hex.

### Surface & ink
| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F5F1` | App background (warm off-white, not cold gray) |
| `--bg-alt` | `#EFEBE3` | Sidebar, hover fills, bottom-tab rest |
| `--surface` | `#FFFFFF` | Cards, panels, modals, inputs |
| `--surface-2` | `#FBFAF7` | Right panel, subtle section wash |
| `--ink` | `#1A1A1A` | Primary text, headings |
| `--ink-2` | `#3D3D3D` | Body text, secondary labels |
| `--ink-3` | `#6B6B6B` | Meta, captions, placeholders |
| `--ink-4` | `#9B9B9B` | Disabled, deepest subdued |
| `--border` | `#E8E4DC` | Default 1px borders |
| `--border-strong` | `#D6D0C3` | Pressed states, scrollbars |
| `--border-soft` | `#EFEBE3` | Row dividers inside cards |

### Brand
| Token | Value | Use |
|---|---|---|
| `--primary` | `#1E5AA8` | Clinical blue. Primary actions, links, brand mark |
| `--primary-hover` | `#174585` | Hover state only |
| `--primary-soft` | `#E4EDF8` | Primary-tinted surfaces (selected slot, context strip) |
| `--primary-ink` | `#FFFFFF` | Text on primary |

### Semantic
| Token | Value | Use |
|---|---|---|
| `--amber` / `--amber-soft` | `#B8500C` / `#FBEADB` | **Allergy warnings** — always use this, not red |
| `--danger` / `--danger-soft` | `#A8321E` / `#F5E1DC` | Destructive, overdue, logout |
| `--success` / `--success-soft` | `#3F7A3A` / `#E1ECDE` | Paid, validated, confirmed-active |

### Patient-status palette
Specifically tuned for the salle d'attente flow. Use these for **pills only**.

| State | BG | Ink |
|---|---|---|
| Arrived (`--status-arrived`) | `#C7DCEE` | `#1C4B75` |
| Waiting (`--status-waiting`) | `#F1E1A5` | `#7A5B10` |
| Vitals in progress (`--status-vitals`) | `#E8D4C3` | `#7A3F10` |
| In consultation (`--status-consult`) | `#C9D9EE` | `#1E5AA8` |
| Done (`--status-done`) | `#D8D8D2` | `#4A4A42` |

**Never invent new semantic colors.** If you need a new state, extend this palette; don't reach for Tailwind defaults.

---

## 3. Typography

Three families, loaded from Google Fonts in `styles.css:3`.

| Variable | Family | Use |
|---|---|---|
| `--font-sans` | `'Inter Tight'` | **All UI.** Body, headings, numerics, nav, buttons |
| `--font-serif` | `'Instrument Serif'` | **Only A4 printed documents** (ordonnance letterhead, facture title). Never in UI. |
| `--font-mono` | `'JetBrains Mono'` | Invoice numbers, CIN, keyboard shortcuts (`⌘ K`) |

Inter Tight weights used: `400` body · `500` labels · `550` emphasized · `600` headings · `700` display numerics.

### Scale (desktop — inside `.cp-app`)
| Size | Weight | Use | Tracking |
|---|---|---|---|
| 10px / 500 uppercase | Section eyebrows (`.cp-nav-section`) | `0.08em` |
| 10.5–11px / 500 | Meta, captions, pills | normal |
| 12–12.5px / 500 | Secondary body, topbar sub, input placeholders | normal |
| 13px / 400–450 | **Default body** (`.cp-app` font-size) | normal |
| 13–14px / 550–600 | Row titles, card headers | `-0.005em` |
| 15px / 550–600 | Page titles, patient names in headers | `-0.01em` |
| 22–28px / 700 | KPI values, large input displays | `-0.02em` |

### Scale (mobile — inside `.cp-mobile`, base 14px)
| Size | Weight | Use |
|---|---|---|
| 10.5px / 550 | Bottom-tab labels |
| 11px / 600 uppercase | Section eyebrows |
| 12–13px / 550 | Meta, subs, pills |
| 14px / 550–600 | Row titles, body (`.m-row-main`) |
| 15px / 600 | Buttons, inputs |
| 17px / 600 | Topbar titles, sheet headers — `-0.015em` |
| 22–30px / 600–700 | Screen titles, stat values, hero display — `-0.02em` |

### Rules
- **Always** `font-feature-settings: "cv11", "ss01", "tnum"` globally on the app root.
- Numeric values (times, prices, TA, weights) **always** get `.tnum` class or inline `font-variant-numeric: tabular-nums`.
- `text-wrap: pretty` on any paragraph > 2 lines.
- Never center-align body copy. Center only short headings, KPI values, and buttons.

---

## 4. Spacing, radii, elevation

### Radii
Short — this is software, not iOS glass.
| Token | px | Use |
|---|---|---|
| `--r-xs` | 3 | Kbd hints, tiny tags |
| `--r-sm` | 4 | Nav items, inputs, small cards |
| `--r-md` | 6 | Buttons, panels, search |
| `--r-lg` | 10 | Mobile buttons, inputs, large cards |

**Mobile** goes larger: cards 12px, sheets 20px top, FAB 16px, bezel inner 44px. Desktop stays crisp; mobile feels native.

### Spacing
No rigid 4/8px grid. The codebase uses organic values (7, 9, 10, 14, 18, 20, 28). When in doubt match neighbors. Common paddings:
- Topbar: `0 20px`, height 56 (desktop) / 52 (mobile)
- Row: `7px 8px` (nav), `10px 14px` (panel-h), `12px 14px` (m-row)
- Panel card: `14px 16px` inner padding
- Section gap: 14–18px between cards
- Screen outer pad (mobile): 16px horizontal, 14–28px vertical

### Shadows
Sparse. Most elevation comes from borders + background contrast.
- Cards: `1px solid var(--border)` — no shadow
- Active nav item: `box-shadow: 0 0 0 1px var(--border)` (ring, not drop)
- Bottom sheet: `0 -4px 20px rgba(0,0,0,0.1)`
- Mobile FAB: `0 4px 16px rgba(30,90,168,0.35), 0 1px 3px rgba(0,0,0,0.1)`
- A4 preview: `0 1px 2px rgba(0,0,0,0.05), 0 12px 40px rgba(0,0,0,0.08)` — **documents feel printed**

---

## 5. Breakpoints & responsive strategy

```
≤640px   → cp-mobile (390×844 design target, iPhone bottom tabs)
641–1023 → desktop layout, sidebar could collapse to icons (not yet implemented)
≥1024    → cp-app (1440×900 design target)
```

Desktop and mobile are **parallel layouts** — not fluid reflow. `.cp-app` (desktop) is a hard 1440×900 component; `.cp-mobile` (mobile) is a hard 390×844 component. The canvas artboards render each at its intended size.

For a real product build, the mobile layouts would be gated behind `@media (max-width: 640px)` and swap in at that breakpoint. Today, Mobile section on the canvas shows 13 iPhone-bezel artboards.

---

## 6. Layout primitives

### Desktop shell — `.cp-app`
```
┌─────────────┬─────────────────────────────────────┐
│             │ .cp-topbar (56h)                    │
│ .cp-sidebar ├─────────────────────────────────────┤
│   (224w)    │ .cp-content                         │
│             │ ┌────────────────┬──────────────┐   │
│             │ │ .cp-workspace  │ .cp-rightp.  │   │
│             │ │ (flex 1)       │ (312w)       │   │
│             │ │                │              │   │
└─────────────┴────────────────┴──────────────┘   │
```
Use `<Screen active="agenda" title="…" right={<RightPanel/>}>` from `shell.jsx`. Right panel is optional.

### Mobile shell — `.cp-mobile`
```
┌───────────────────────┐
│ .mt (52h)             │  ← MTopbar(title, left, right, brand)
├───────────────────────┤
│ .mb (flex 1, scroll)  │  ← content
│                       │
│       [ .m-fab ]      │  ← optional absolute-positioned FAB
├───────────────────────┤
│ .mtabs (76h)          │  ← MTabs(active, badges)
└───────────────────────┘
```
Use `<MScreen tab="agenda" topbar={<MTopbar…/>} fab={…}>` from `mobile/shell.jsx`.

### Navigation

**Desktop sidebar** (`shell.jsx:4–56`): 6 items split across "Flux patient" (Agenda, Patients, Salle, Consultations, Facturation) and "Configuration" (Paramètres). Badge on Salle = waiting patients.

**Mobile bottom tabs** (`mobile/shell.jsx`): 5 slots — Agenda, Salle, Patients, Factures, Plus. "Plus" opens params/settings/logout.

---

## 7. Components

### Buttons — `.btn`
```
.btn            Default secondary — white bg, border
.btn.primary    Clinical blue bg, white text
.btn.ghost      No border, transparent
.btn.danger     Danger ink on default background
.btn.sm / .lg   26h / 38h (default 32h)
.btn.icon       32×32 square for icon-only
```
Mobile counterparts: `.m-btn`, `.m-btn.primary`, `.m-btn.secondary`, `.m-btn.sm` — **48px height by default** for thumb.

### Pills — `.pill`
Status pills. Always include the status class:
```
.pill.arrived .pill.waiting .pill.vitals .pill.consult .pill.done .pill.allergy
```
Mobile: `.m-pill.<status>` — same palette, slightly larger padding.

### Panels — `.panel`
```
<div class="panel">
  <div class="panel-h">Header</div>
  <div>Content with own padding</div>
</div>
```
Mobile equivalent: `.m-card` — 12px radius, overflow hidden, rows stack inside with `.m-row + .m-row { border-top }`.

### Forms
Desktop:
```
<div class="field">
  <label>Motif</label>
  <input class="input" />      ← 34h
  <select class="select" />
  <textarea class="textarea" /> ← 70min, resize vertical
  <div class="help">Optional helper</div>
</div>
```
Focus ring: 3px `rgba(30,90,168,0.14)` + 1px primary border.

Mobile:
```
<div class="m-field">
  <label>Motif</label>
  <input class="m-input" />         ← 46h
  <textarea class="m-input m-textarea" />
</div>
```

### Segmented control (mobile only)
`.m-segmented > button[.on]` — 34h, pill-ish, `var(--bg-alt)` track, white thumb.

### Day-tab strip (mobile agenda)
`.m-daytabs > .m-daytab[.on]` — horizontal scroll, 52w min per day, primary fill when active.

### Stat / KPI tile (mobile)
```
<div class="m-stat">
  <div class="m-stat-k">Label</div>
  <div class="m-stat-v">42 750<span class="m-stat-u">MAD</span></div>
</div>
```
Used in 2×2 grid via `.m-stat-grid`.

### Vertical timeline (mobile agenda)
```
<div class="m-tl">
  <div class="m-tl-row">
    <div class="m-tl-hour">09:30</div>
    <div class="m-tl-col filled">
      <div class="m-tl-block confirmed">…</div>
    </div>
  </div>
</div>
```
Block variants: `.confirmed`, `.arrived`, `.vitals`, `.consult`, `.done` — each swaps left-border color + tinted background.

### Bottom sheet (mobile modals)
```
<div class="m-sheet-backdrop">
  <div class="m-sheet">
    <div class="m-sheet-grab" />
    <div class="m-sheet-title">…</div>
    …
  </div>
</div>
```
Replaces desktop modals on phone. Backdrop `rgba(0,0,0,0.4)`, radius 20px top only.

### Avatar — `.cp-avatar`
28×28 default, `.sm` 22px, `.lg` 40px. Solid `--primary` fill, white initials, 2 chars max.

### A4 document — `.a4`
```
794 × 1123 (A4 @ 96dpi)
padding: 56px 64px
```
Always shadowed, always white, centered with `margin: 28px auto`. Serif usage allowed here only.

---

## 8. Iconography

30-icon set in `icons.jsx`. **1.5px stroke, 16×16 viewBox, currentColor.** Never fill. Never color independently — icons inherit from text.

**Available**: `Calendar Users Waiting Stetho Invoice Settings Search Plus Bell ChevronLeft ChevronRight ChevronDown ChevronUp Close Check Phone Print Pill Flask Scan Warn Heart Thermo Clipboard File Edit Trash Eye MoreH Lock Logout Sun Clock Doc Dot Menu Filter Signal`

Usage:
```jsx
<Icon.Calendar />    // 16×16 by default
<span style={{color:'var(--primary)'}}><Icon.Pill /></span>  // tint via parent
```

**If you add a new icon**: match the visual language — 1.5 stroke, rounded caps/joins, no fills (except `Dot` and status indicators). Keep inside 16×16. Don't use Lucide/Heroicons verbatim — re-draw to match existing weights.

---

## 9. Screens map

13 screens, each in `screens/*.jsx` (desktop) and mirrored in `mobile/screens.jsx` with `M` prefix. All registered to `window` at file end.

| # | Desktop | Mobile | Purpose |
|---|---|---|---|
| 01 | `<AgendaSemaine/>` | `<MAgenda/>` | Week grid / day timeline |
| 02 | `<PriseRDV/>` | `<MPriseRDV/>` | New appointment (modal → full screen) |
| 03 | `<DossierPatient/>` | `<MDossier/>` | Patient file, tabbed |
| 04 | `<SalleAttente/>` | `<MSalle/>` | Waiting-room queue + KPIs |
| 05 | `<PriseConstantes/>` | `<MConstantes/>` | Vitals entry (large numeric inputs) |
| 06 | `<EcranConsultation/>` | `<MConsultation/>` | SOAP consultation |
| 07 | `<PrescriptionDrawer/>` | `<MPrescription/>` | Rx builder |
| 08 | `<ApercuOrdonnance/>` | `<MApercuOrdo/>` | A4 print preview |
| 09 | `<Facturation/>` | `<MFacturation/>` | Invoice list + KPIs |
| 10 | `<ApercuFacture/>` | `<MApercuFacture/>` | A4 invoice preview |
| 11 | `<Parametrage/>` | `<MParametrage/>` | Settings |
| 12 | `<Login/>` | `<MLogin/>` | Auth |
| 13 | `<Onboarding/>` | `<MOnboarding/>` | 7-step wizard |

All rendered inside `<DesignCanvas>` via `careplus.html`.

---

## 10. Content & copy conventions

- **Language**: French (France variant, not Québec). Medical terms in French (tension artérielle, fréquence cardiaque, ordonnance).
- **Dates**: `24 avril 2026`, `24/04/2026`, `Jeudi 24 avril`. Never ISO.
- **Times**: 24h format, colon separator: `09:30`, `14:00`.
- **Money**: `300 MAD`, `2 450,00 MAD` — space as thousands separator, comma as decimal.
- **Numbers**: Always tabular in UI.
- **Names**: Full Moroccan names — `Mohamed Alami`, `Fatima Z. Lahlou`, `Khadija Tahiri`, `Dr. Karim El Amrani`.
- **IDs**: `CIN BE 138 475`, `ICE 001234567000089`, `INPE 12345` — realistic formats.
- **Allergies**: Amber pill with `Warn` icon. Always prominent near the patient context.

---

## 11. Don'ts

- ❌ No gradients except the Login hero (clinical blue → deep navy).
- ❌ No rounded-corner containers with accent left-borders (except the A4 document prescription line-items — contextual to print).
- ❌ No emoji anywhere.
- ❌ No Tailwind. Use the custom properties.
- ❌ No `rounded-full` buttons — this is a tool, not a marketing site.
- ❌ No dark mode (not designed yet — would need re-toning the status palette).
- ❌ No hover-lift transforms on cards.
- ❌ Don't use `Inter` / `Roboto` / system stack — the design depends on Inter Tight's tighter metrics.
- ❌ Don't put Instrument Serif anywhere outside A4 documents.
- ❌ Don't use red for allergies — it's amber. Red is destructive/overdue only.

---

## 12. File layout

```
careplus.html              ← entry; DesignCanvas with all sections
styles.css                 ← desktop design tokens + .cp-app shell
mobile-styles.css          ← mobile-specific (.cp-mobile, .mt, .mb, .mtabs, .m-*)
icons.jsx                  ← Icon.* export (30 icons)
shell.jsx                  ← <Sidebar/> <Topbar/> <Screen/>
design-canvas.jsx          ← DesignCanvas / DCSection / DCArtboard (starter)
ios-frame.jsx              ← iOS device bezel starter (not used in main canvas — simpler <Phone/> inline in careplus.html)
screens/*.jsx              ← 13 desktop screens
mobile/shell.jsx           ← <MScreen/> <MTopbar/> <MTabs/> <MIconBtn/>
mobile/screens.jsx         ← 13 mobile screens
```

All JSX scripts load with `<script type="text/babel">` in `careplus.html`. Every component file **must** end with `Object.assign(window, { … })` to expose components across script scopes (Babel scripts don't share scope by default).

Never use `const styles = {}` — name style objects after the component (e.g. `const agendaStyles`) to avoid cross-file collisions.
