/**
 * Provider i18n (#122). Lit la langue du cabinet (réglage super admin, V071),
 * expose un traducteur `t(key, vars?)` et applique `dir`/`lang` sur <html> pour
 * la bascule RTL (arabe). Aucune dépendance externe.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { isRtl, type Lang } from './index';
import { MESSAGES } from './messages';

export interface I18nContextValue {
  lang: Lang;
  rtl: boolean;
  /** Traduit une clé ; interpole {var} depuis `vars`. Fallback fr puis la clé brute. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useClinicSettings();
  const lang = (settings?.language ?? 'fr') as Lang;
  const rtl = isRtl(lang);

  // Applique dir + lang au document : pilote le RTL global (l'arabe) et l'a11y.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('lang', lang);
    el.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  }, [lang, rtl]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = MESSAGES[lang] ?? MESSAGES.fr;
    const fr = MESSAGES.fr;
    return {
      lang,
      rtl,
      t: (key, vars) => interpolate(dict[key] ?? fr[key] ?? key, vars),
    };
  }, [lang, rtl]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook de traduction. Hors provider (tests de composants isolés), retombe sur fr
 * + identité — le composant rend du texte français plutôt que de planter.
 */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const fr = MESSAGES.fr;
  return {
    lang: 'fr',
    rtl: false,
    t: (key, vars) => interpolate(fr[key] ?? key, vars),
  };
}
