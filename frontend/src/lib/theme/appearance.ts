/**
 * Apparence de l'application — thème configurable par le super admin (V072).
 *
 * Issu du panneau « Tweaks » de la maquette « careplus refresh - chambres & lits
 * (calm premium) » : police · ambiance (canvas) · accent · mode sombre. Ici on
 * applique ces réglages aux tokens CSS GLOBAUX (`:root` de tokens.css +
 * design-system-v2.css) en écrivant des variables sur <html>, qui l'emportent
 * sur les `:root`. Toute l'app bascule d'un coup (surfaces, encre, accent, nav,
 * boutons, graphes…).
 *
 * Persistance : champ `appearance` (JSON) de /settings/clinic, réglage cabinet
 * protégé super admin — exactement comme `language` (V071). Un cache localStorage
 * permet d'appliquer le thème AVANT le premier rendu React (zéro flash).
 */

export type ThemeFont = 'geist' | 'jakarta' | 'system';
// Les 10 ambiances « canvas » du design system Calm Premium (careplus-calm.css,
// valeurs hex canoniques) + `default` = palette « frais » historique de l'app.
export type ThemeTone =
  | 'default'
  | 'stone'
  | 'sand'
  | 'clay'
  | 'sage'
  | 'mist'
  | 'cool'
  | 'slate'
  | 'lavender'
  | 'porcelain'
  | 'warmgrey';

export type RoleFill = 'ink' | 'accent';
export type LogoMark = 'bloom' | 'cross' | 'pulse' | 'overlap' | 'mono' | 'module';

export interface Appearance {
  /** Police de l'interface. */
  font: ThemeFont;
  /** Ambiance « canvas » (chaleur des fonds + encre). Ignorée en mode sombre. */
  tone: ThemeTone;
  /** Couleur d'accent (hex), pilote nav active / CTA / graphes / sélection. */
  accent: string;
  /** Mode sombre. */
  dark: boolean;
  /** Remplissage de l'item de navigation actif : encre (sombre) ou accent. */
  navActive: RoleFill;
  /** Remplissage des boutons primaires : encre (sombre) ou accent. */
  btnPrimary: RoleFill;
  /** Concept de marque (logo) rendu dans la sidebar. */
  logo: LogoMark;
  /** Fond du conteneur logo (hex). */
  logoBg: string;
  /** Couleur du signe / glyphe du logo (hex). */
  logoFg: string;
}

export const APPEARANCE_DEFAULT: Appearance = {
  font: 'geist',
  tone: 'default',
  accent: '#1e4dab',
  dark: false,
  navActive: 'accent',
  btnPrimary: 'accent',
  logo: 'cross',
  logoBg: '#1e4dab',
  logoFg: '#ffffff',
};

export const ROLE_FILL_OPTIONS: { value: RoleFill; labelKey: string }[] = [
  { value: 'ink', labelKey: 'settings.appearance.fill.ink' },
  { value: 'accent', labelKey: 'settings.appearance.fill.accent' },
];

export const LOGO_OPTIONS: { value: LogoMark; labelKey: string }[] = [
  { value: 'bloom', labelKey: 'settings.appearance.logo.bloom' },
  { value: 'cross', labelKey: 'settings.appearance.logo.cross' },
  { value: 'pulse', labelKey: 'settings.appearance.logo.pulse' },
  { value: 'overlap', labelKey: 'settings.appearance.logo.overlap' },
  { value: 'mono', labelKey: 'settings.appearance.logo.mono' },
  { value: 'module', labelKey: 'settings.appearance.logo.module' },
];

export const LOGO_BG_OPTIONS = ['#1c1b18', '#1e4dab', '#5b53d8', '#0e5b3e', '#ffffff'];
export const LOGO_FG_OPTIONS = ['#ffffff', '#1c1b18', '#1e4dab', '#5b53d8'];

export const FONT_OPTIONS: { value: ThemeFont; label: string; stack: string; labelKey?: string }[] = [
  { value: 'geist', label: 'Geist', stack: "'Geist', ui-sans-serif, system-ui, sans-serif" },
  {
    value: 'jakarta',
    label: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  },
  { value: 'system', label: 'Système', stack: 'ui-sans-serif, system-ui, -apple-system, sans-serif', labelKey: 'settings.appearance.font.system' },
];

/** Ambiances claires : fonds + hairlines + encre. `surface` reste blanc en clair. */
interface Tone {
  bg: string;
  surface2: string;
  border: string;
  borderStrong: string;
  borderSoft: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
}

export const TONES: Record<ThemeTone, Tone> = {
  // Thème historique de l'app (DS v2 « cool ») — défaut, rien ne change.
  default: {
    bg: '#edf2fa', surface2: '#f4f7fc', border: '#e2e7ef', borderStrong: '#d2dceb',
    borderSoft: '#eef2f8', ink: '#0b1410', ink2: '#2f3a35', ink3: '#646d67', ink4: '#9aa29d',
  },
  // « Calm Premium » — canvas pierre chaude.
  stone: {
    bg: '#f4f2ed', surface2: '#faf8f4', border: '#e8e5dd', borderStrong: '#ddd9cf',
    borderSoft: '#f1efe9', ink: '#1c1b18', ink2: '#46443e', ink3: '#787469', ink4: '#aaa59a',
  },
  sand: {
    bg: '#f1eadd', surface2: '#faf6ee', border: '#e6ddcb', borderStrong: '#dad0bb',
    borderSoft: '#efe9dc', ink: '#211d15', ink2: '#4b453a', ink3: '#7c7563', ink4: '#aba48f',
  },
  clay: {
    bg: '#f2e9e3', surface2: '#fbf5f1', border: '#e8dad0', borderStrong: '#dccdbf',
    borderSoft: '#f0e7e0', ink: '#211b16', ink2: '#4b423b', ink3: '#7d7268', ink4: '#ac9f94',
  },
  sage: {
    bg: '#eceee8', surface2: '#f7f8f4', border: '#dfe3da', borderStrong: '#d2d7cb',
    borderSoft: '#ebede7', ink: '#181b16', ink2: '#41463c', ink3: '#71766a', ink4: '#a4a899',
  },
  mist: {
    bg: '#edf0f2', surface2: '#f7f9fa', border: '#e1e6e9', borderStrong: '#d3d9dd',
    borderSoft: '#eceff1', ink: '#161a1c', ink2: '#3e454a', ink3: '#6d757a', ink4: '#a2aab0',
  },
  cool: {
    bg: '#eff2f7', surface2: '#f7f9fc', border: '#e4e8ef', borderStrong: '#d4dae6',
    borderSoft: '#eef1f6', ink: '#171a1f', ink2: '#3f454e', ink3: '#6e7480', ink4: '#a4a9b3',
  },
  slate: {
    bg: '#ebedf1', surface2: '#f6f7fa', border: '#e0e3ea', borderStrong: '#d2d6df',
    borderSoft: '#ebedf2', ink: '#15171c', ink2: '#3c4049', ink3: '#6b707b', ink4: '#a1a6b0',
  },
  lavender: {
    bg: '#efedf4', surface2: '#f8f6fb', border: '#e5e1ee', borderStrong: '#d8d2e6',
    borderSoft: '#efecf5', ink: '#1a1820', ink2: '#44414e', ink3: '#757180', ink4: '#a8a4b2',
  },
  porcelain: {
    bg: '#f3f5f6', surface2: '#fbfcfc', border: '#e6e9eb', borderStrong: '#d8dcdf',
    borderSoft: '#f0f2f3', ink: '#15171a', ink2: '#3d4247', ink3: '#6c7177', ink4: '#a1a6ac',
  },
  warmgrey: {
    bg: '#f2f1ef', surface2: '#fafaf8', border: '#e7e5e1', borderStrong: '#dad7d1',
    borderSoft: '#f0efec', ink: '#1b1b1a', ink2: '#454440', ink3: '#76746e', ink4: '#a9a6a0',
  },
};

export const TONE_OPTIONS: { value: ThemeTone; label: string; labelKey: string }[] = [
  { value: 'default', label: 'Défaut (frais)', labelKey: 'settings.appearance.tone.default' },
  { value: 'stone', label: 'Pierre (calm premium)', labelKey: 'settings.appearance.tone.stone' },
  { value: 'sand', label: 'Sable', labelKey: 'settings.appearance.tone.sand' },
  { value: 'clay', label: 'Argile', labelKey: 'settings.appearance.tone.clay' },
  { value: 'sage', label: 'Sauge', labelKey: 'settings.appearance.tone.sage' },
  { value: 'mist', label: 'Brume', labelKey: 'settings.appearance.tone.mist' },
  { value: 'cool', label: 'Frais', labelKey: 'settings.appearance.tone.cool' },
  { value: 'slate', label: 'Ardoise', labelKey: 'settings.appearance.tone.slate' },
  { value: 'lavender', label: 'Lavande', labelKey: 'settings.appearance.tone.lavender' },
  { value: 'porcelain', label: 'Porcelaine', labelKey: 'settings.appearance.tone.porcelain' },
  { value: 'warmgrey', label: 'Gris chaud', labelKey: 'settings.appearance.tone.warmgrey' },
];

export const ACCENT_OPTIONS: { value: string; label: string; labelKey: string }[] = [
  { value: '#1e4dab', label: 'Saphir', labelKey: 'settings.appearance.accent.saphir' },
  { value: '#0e5b3e', label: 'Vert bouteille', labelKey: 'settings.appearance.accent.vertBouteille' },
  { value: '#5b53d8', label: 'Indigo', labelKey: 'settings.appearance.accent.indigo' },
  { value: '#b0410f', label: 'Terracotta', labelKey: 'settings.appearance.accent.terracotta' },
  { value: '#1f1f1f', label: 'Encre', labelKey: 'settings.appearance.accent.encre' },
];

/** Palette sombre (la « tone » est ignorée en sombre, comme dans la maquette). */
const DARK = {
  bg: '#121319', surface: '#1b1c23', surface2: '#23242c', border: '#2e2f39',
  borderStrong: '#3a3b46', borderSoft: '#26272f', ink: '#f3f3f1', ink2: '#c7c7cc',
  ink3: '#9b9ba4', ink4: '#6e6e78',
};

// ── helpers couleur ──────────────────────────────────────────────────────────
function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number) {
  return '#' + ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1);
}
/** Éclaircit vers le blanc de `p` (0..1). */
function tint(hex: string, p: number) {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * p, g + (255 - g) * p, b + (255 - b) * p);
}
/** Assombrit de `p` (0..1). */
function shade(hex: string, p: number) {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - p), g * (1 - p), b * (1 - p));
}
/** Accent translucide (8 chiffres hex) pour fonds doux en sombre. */
function alpha(hex: string, hex2: string) {
  return hex + hex2;
}

// ── application ──────────────────────────────────────────────────────────────

/**
 * Écrit les variables CSS d'apparence sur <html>. Ces déclarations inline
 * l'emportent sur les blocs `:root`, donc surchargent les tokens app v2 ET les
 * tokens `--ds2-*` lus par le shell.
 */
export function applyAppearance(cfg: Appearance): void {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  const a = cfg.accent || APPEARANCE_DEFAULT.accent;

  // Police
  const font = FONT_OPTIONS.find((f) => f.value === cfg.font) ?? FONT_OPTIONS[0]!;
  set('--font-sans', font.stack);
  set('--ds2-font', font.stack);

  // Surfaces + encre (sombre OU ambiance claire)
  const surface = cfg.dark ? DARK.surface : '#ffffff';
  const t: Tone = cfg.dark
    ? {
        bg: DARK.bg, surface2: DARK.surface2, border: DARK.border, borderStrong: DARK.borderStrong,
        borderSoft: DARK.borderSoft, ink: DARK.ink, ink2: DARK.ink2, ink3: DARK.ink3, ink4: DARK.ink4,
      }
    : (TONES[cfg.tone] ?? TONES.default);

  set('--bg', t.bg);
  set('--bg-alt', t.surface2);
  set('--surface', surface);
  set('--surface-2', t.surface2);
  set('--border', t.border);
  set('--border-strong', t.borderStrong);
  set('--border-soft', t.borderSoft);
  set('--ink', t.ink);
  set('--ink-2', t.ink2);
  set('--ink-3', t.ink3);
  set('--ink-4', t.ink4);
  // Miroir des tokens --ds2-* lus par le shell / la topbar / l'agenda.
  set('--ds2-bg', t.bg);
  set('--ds2-surface', surface);
  set('--ds2-surface-2', t.surface2);
  set('--ds2-border', t.border);
  set('--ds2-border-strong', t.borderStrong);
  set('--ds2-ink', t.ink);
  set('--ds2-ink-2', t.ink2);
  set('--ds2-ink-3', t.ink3);
  set('--ds2-ink-4', t.ink4);

  // Accent (CTA / nav active / sélection / graphes)
  const accentHover = cfg.dark ? tint(a, 0.16) : shade(a, 0.18);
  const accentSoft = cfg.dark ? alpha(a, '33') : tint(a, 0.86);
  const accentChartSoft = cfg.dark ? alpha(a, '40') : tint(a, 0.78);
  set('--primary', a);
  set('--primary-hover', accentHover);
  set('--primary-soft', accentSoft);
  set('--primary-ink', '#ffffff');
  set('--ds2-navy', a);
  set('--ds2-navy-hover', accentHover);
  set('--ds2-navy-soft', accentSoft);
  set('--ds2-navy-chart-soft', accentChartSoft);
  set('--ds2-primary', a);
  set('--ds2-primary-hover', accentHover);
  set('--ds2-blue', a);
  set('--ds2-indigo', cfg.dark ? tint(a, 0.28) : shade(a, 0.02));
  set('--status-consult', accentSoft);
  set('--status-consult-ink', cfg.dark ? tint(a, 0.5) : a);

  // Fonds doux sémantiques + pastilles de statut (lisibles en sombre)
  if (cfg.dark) {
    set('--success-soft', '#16291f');
    set('--danger-soft', '#311b14');
    set('--amber-soft', '#2c2410');
    set('--status-arrived', '#16291f');
    set('--status-arrived-ink', '#57c089');
    set('--status-waiting', '#2c2410');
    set('--status-waiting-ink', '#d6a85a');
    set('--status-vitals', '#2c2410');
    set('--status-vitals-ink', '#d6a85a');
    set('--status-done', '#23242c');
    set('--status-done-ink', '#9b9ba4');
    // Ombres tunées pour le clair (rgba bleutée quasi invisible sur fond sombre).
    set('--ds2-shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.4)');
    set('--ds2-shadow-pop', '0 12px 32px rgba(0, 0, 0, 0.55)');
    root.style.colorScheme = 'dark';
  } else {
    // Restaure les valeurs claires d'origine (tokens.css) si on quitte le sombre.
    set('--success-soft', '#d9eae0');
    set('--danger-soft', '#f8ddd2');
    set('--amber-soft', '#f4e4c4');
    set('--status-arrived', '#d9eae0');
    set('--status-arrived-ink', '#0a4630');
    set('--status-waiting', '#f4e4c4');
    set('--status-waiting-ink', '#6e4a0a');
    set('--status-vitals', '#f4e4c4');
    set('--status-vitals-ink', '#6e4a0a');
    set('--status-done', '#F2F1EC');
    set('--status-done-ink', '#6B6B6B');
    set('--ds2-shadow-sm', '0 1px 2px rgba(20, 40, 80, 0.04)');
    set('--ds2-shadow-pop', '0 8px 24px rgba(20, 40, 80, 0.12)');
    root.style.colorScheme = 'light';
  }

  // Rôles « ink / accent » — nav active + boutons primaires (iso Tweaks).
  // En sombre, « ink » devient une pastille claire pour rester lisible.
  const inkPair: [string, string] = cfg.dark ? ['#ececef', '#15151a'] : [t.ink, '#ffffff'];
  const accentPair: [string, string] = [a, '#ffffff'];
  const nav = cfg.navActive === 'accent' ? accentPair : inkPair;
  const btn = cfg.btnPrimary === 'accent' ? accentPair : inkPair;
  set('--nav-active-bg', nav[0]);
  set('--nav-active-fg', nav[1]);
  set('--btn-primary-bg', btn[0]);
  set('--btn-primary-fg', btn[1]);

  // Logo (fond / signe) — la marque est rendue par <ConfigurableBrandMark>.
  set('--logo-bg', cfg.logoBg);
  set('--logo-fg', cfg.logoFg);
  set('--logo-accent', a);

  // Marqueur pour des ajustements CSS ciblés (cf. theme.css).
  root.dataset.theme = cfg.dark ? 'dark' : 'light';

  // Notifie les abonnés React (logo) — applyAppearance est l'unique point
  // d'application (preview ET save), donc l'aperçu du logo est réactif.
  _applied = cfg;
  _subs.forEach((cb) => cb());
}

// ── store minimal pour le logo (réactif au preview) ──────────────────────────
let _applied: Appearance = APPEARANCE_DEFAULT;
const _subs = new Set<() => void>();
/** Snapshot de la dernière apparence appliquée (preview ou save). */
export function getAppliedAppearance(): Appearance {
  return _applied;
}
/** S'abonne aux changements d'apparence appliquée (useSyncExternalStore). */
export function subscribeAppearance(cb: () => void): () => void {
  _subs.add(cb);
  return () => {
    _subs.delete(cb);
  };
}

// ── (dé)sérialisation + cache ────────────────────────────────────────────────

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function normalizeAppearance(raw: unknown): Appearance {
  const o = (raw ?? {}) as Partial<Appearance>;
  const fonts: ThemeFont[] = ['geist', 'jakarta', 'system'];
  const tones = Object.keys(TONES) as ThemeTone[];
  const fills: RoleFill[] = ['ink', 'accent'];
  const logos: LogoMark[] = ['bloom', 'cross', 'pulse', 'overlap', 'mono', 'module'];
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && HEX6.test(v) ? v : fb);
  // .find évite un cast `as` (le linter préfère, et c'est plus sûr).
  return {
    font: fonts.find((f) => f === o.font) ?? APPEARANCE_DEFAULT.font,
    tone: tones.find((t) => t === o.tone) ?? APPEARANCE_DEFAULT.tone,
    accent: hex(o.accent, APPEARANCE_DEFAULT.accent),
    dark: typeof o.dark === 'boolean' ? o.dark : APPEARANCE_DEFAULT.dark,
    navActive: fills.find((f) => f === o.navActive) ?? APPEARANCE_DEFAULT.navActive,
    btnPrimary: fills.find((f) => f === o.btnPrimary) ?? APPEARANCE_DEFAULT.btnPrimary,
    logo: logos.find((l) => l === o.logo) ?? APPEARANCE_DEFAULT.logo,
    logoBg: hex(o.logoBg, APPEARANCE_DEFAULT.logoBg),
    logoFg: hex(o.logoFg, APPEARANCE_DEFAULT.logoFg),
  };
}

/** Parse le JSON stocké côté backend ; tout échec retombe sur le défaut. */
export function parseAppearance(json: string | null | undefined): Appearance {
  if (!json) return { ...APPEARANCE_DEFAULT };
  try {
    return normalizeAppearance(JSON.parse(json));
  } catch {
    return { ...APPEARANCE_DEFAULT };
  }
}

export function serializeAppearance(cfg: Appearance): string {
  return JSON.stringify(cfg);
}

const CACHE_KEY = 'careplus.appearance';

/** Lit le dernier thème appliqué (cache local) — pour appliquer avant le rendu. */
export function readCachedAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(CACHE_KEY));
  } catch {
    return { ...APPEARANCE_DEFAULT };
  }
}

export function cacheAppearance(cfg: Appearance): void {
  try {
    localStorage.setItem(CACHE_KEY, serializeAppearance(cfg));
  } catch {
    /* stockage indisponible — sans gravité, le backend reste la source de vérité */
  }
}
