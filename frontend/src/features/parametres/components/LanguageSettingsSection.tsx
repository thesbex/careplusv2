/**
 * #122 — sélecteur de langue de l'application, réservé au SUPER_ADMIN (V071).
 *
 * La langue est un champ protégé de /settings/clinic (garde super admin côté
 * backend). On renvoie l'identité inchangée + la nouvelle langue. Le changement
 * met à jour le cache clinic-settings → I18nProvider re-rend toute l'app et
 * bascule dir=rtl pour l'arabe.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { useClinicSettings, type ClinicSettings } from '../hooks/useSettings';
import { api } from '@/lib/api/client';
import { SUPPORTED_LANGS, type Lang } from '@/lib/i18n';
import { useT } from '@/lib/i18n/I18nProvider';

export function LanguageSettingsSection() {
  const { settings } = useClinicSettings();
  const qc = useQueryClient();
  const { t } = useT();
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const [saving, setSaving] = useState<Lang | null>(null);

  const current = (settings?.language ?? 'fr') as Lang;

  async function choose(lang: Lang) {
    if (!settings || lang === current) return;
    setSaving(lang);
    try {
      const updated = await api
        .put<ClinicSettings>('/settings/clinic', {
          name: settings.name,
          address: settings.address,
          city: settings.city,
          phone: settings.phone,
          email: settings.email ?? '',
          inpe: settings.inpe ?? '',
          cnom: settings.cnom ?? '',
          ice: settings.ice ?? '',
          rib: settings.rib ?? '',
          language: lang,
        })
        .then((r) => r.data);
      qc.setQueryData(['clinic-settings'], updated);
      toast.success(t('settings.language.saved'));
    } catch {
      toast.error('Échec de la mise à jour de la langue.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel data-testid="language-settings">
      <PanelHeader>{t('settings.language.title')}</PanelHeader>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('settings.language.hint')}
        </div>
        {!isSuperAdmin && (
          <div
            role="note"
            style={{
              fontSize: 12, color: 'var(--ink-2)', marginBottom: 12,
              background: 'var(--amber-soft, #fff4e0)',
              border: '1px solid var(--amber, #e0a23a)',
              borderRadius: 'var(--r-md, 8px)', padding: '8px 12px',
            }}
          >
            {t('settings.language.readonly')}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUPPORTED_LANGS.map((l) => {
            const active = l.code === current;
            return (
              <button
                key={l.code}
                type="button"
                disabled={!isSuperAdmin || saving !== null}
                aria-pressed={active}
                aria-label={l.label}
                onClick={() => void choose(l.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', fontSize: 13, fontFamily: 'inherit',
                  borderRadius: 'var(--r-md, 8px)', cursor: isSuperAdmin ? 'pointer' : 'not-allowed',
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--primary-soft)' : 'var(--surface)',
                  color: active ? 'var(--primary)' : 'var(--ink)',
                  fontWeight: active ? 650 : 500,
                  opacity: !isSuperAdmin && !active ? 0.55 : 1,
                }}
              >
                {l.label}
                {l.rtl && (
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>RTL</span>
                )}
                {saving === l.code && <span style={{ fontSize: 10 }}>…</span>}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
