/**
 * i18n maison (#122) — zéro dépendance externe.
 *
 * Choix : pas de react-i18next ni i18next pour rester aligné sur la contrainte
 * on-prem + design custom du projet (cf. ADR-015/016/017). Notre besoin v1 est
 * simple : 4 langues (fr/en/ar/es), clés plates, interpolation `{var}`, bascule
 * RTL pour l'arabe. Une `Map<clé, string>` par langue + un Context suffisent.
 *
 * La langue effective vient du réglage cabinet (configuration_clinic_settings.
 * language, réglé par le super admin — V071). Tant que les settings ne sont pas
 * chargés, on rend en `fr` (défaut historique, aucune régression).
 */
export type Lang = 'fr' | 'en' | 'ar' | 'es';

export const SUPPORTED_LANGS: { code: Lang; label: string; rtl: boolean }[] = [
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'en', label: 'English', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'es', label: 'Español', rtl: false },
];

export const RTL_LANGS: ReadonlySet<Lang> = new Set<Lang>(['ar']);

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.has(lang);
}

/** Dictionnaire plat par langue. Les clés absentes retombent sur fr puis la clé. */
export type Dict = Record<string, string>;
