import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider, useT } from '../I18nProvider';
import { MESSAGES } from '../messages';
import { SUPPORTED_LANGS, isRtl } from '../index';

// L'I18nProvider lit la langue via useClinicSettings (React Query). On préremplit
// le cache ['clinic-settings'] avec la langue voulue pour piloter le rendu sans
// réseau.
function withLang(lang: string, ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['clinic-settings'], {
    id: 'c1', name: 'Cab', address: 'a', city: 'c', phone: 'p',
    email: null, inpe: null, cnom: null, ice: null, rib: null,
    language: lang,
  });
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>
  );
}

function Probe() {
  const { t, lang, rtl } = useT();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="rtl">{String(rtl)}</span>
      <span data-testid="agenda">{t('nav.agenda')}</span>
      <span data-testid="missing">{t('totally.unknown.key')}</span>
    </div>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('i18n catalogue', () => {
  it('exposes the 4 required languages', () => {
    expect(SUPPORTED_LANGS.map((l) => l.code)).toEqual(['fr', 'en', 'ar', 'es']);
  });

  it('only Arabic is RTL', () => {
    expect(isRtl('ar')).toBe(true);
    ['fr', 'en', 'es'].forEach((l) => expect(isRtl(l as never)).toBe(false));
  });

  it('every key in fr exists in en/ar/es (no missing translations for shipped keys)', () => {
    const frKeys = Object.keys(MESSAGES.fr);
    for (const lang of ['en', 'ar', 'es'] as const) {
      const missing = frKeys.filter((k) => !(k in MESSAGES[lang]));
      expect(missing, `clés manquantes en ${lang}: ${missing.join(', ')}`).toHaveLength(0);
    }
  });
});

describe('<I18nProvider /> + useT', () => {
  it('translates to French by default', () => {
    render(withLang('fr', <Probe />));
    expect(screen.getByTestId('agenda')).toHaveTextContent('Agenda');
    expect(screen.getByTestId('rtl')).toHaveTextContent('false');
  });

  it('translates to Arabic and flags RTL', () => {
    render(withLang('ar', <Probe />));
    expect(screen.getByTestId('lang')).toHaveTextContent('ar');
    expect(screen.getByTestId('rtl')).toHaveTextContent('true');
    expect(screen.getByTestId('agenda')).toHaveTextContent('الأجندة');
  });

  it('sets <html dir="rtl" lang="ar"> for Arabic', () => {
    render(withLang('ar', <Probe />));
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('sets <html dir="ltr"> for Spanish', () => {
    render(withLang('es', <Probe />));
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('agenda')).toHaveTextContent('Agenda');
  });

  it('falls back to the raw key when a translation is missing', () => {
    render(withLang('fr', <Probe />));
    expect(screen.getByTestId('missing')).toHaveTextContent('totally.unknown.key');
  });
});
