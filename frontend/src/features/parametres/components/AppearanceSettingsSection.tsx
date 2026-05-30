/**
 * Apparence (V072) — panneau « Tweaks » de la maquette « calm premium » porté en
 * réglage cabinet réservé au SUPER_ADMIN : police · ambiance (canvas) · accent ·
 * mode sombre. Aperçu instantané (preview) ; persistance explicite (Enregistrer).
 *
 * Le thème s'applique à TOUTE l'app via des variables CSS sur <html>
 * (cf. lib/theme/appearance.ts). La garde réelle est backend (403 si non super
 * admin) ; côté IHM les contrôles sont désactivés pour un ADMIN normal.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useAppearance } from '../hooks/useAppearance';
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
  LOGO_BG_OPTIONS,
  LOGO_FG_OPTIONS,
  LOGO_OPTIONS,
  ROLE_FILL_OPTIONS,
  TONE_OPTIONS,
  TONES,
  type Appearance,
} from '@/lib/theme/appearance';

function SuperAdminBadge({ label }: { label: string }) {
  return (
    <span
      title="Réservé au super administrateur"
      style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        color: 'var(--primary)', background: 'var(--primary-soft)',
        border: '1px solid var(--primary)', borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap',
      }}
    >
      🔒 {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--ink-3)', margin: '4px 0 2px',
    }}>
      {children}
    </div>
  );
}

/** Pastille de choix générique (chip). */
function Chip({
  active, disabled, onClick, children, title,
}: {
  active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '8px 13px', fontSize: 13, fontFamily: 'inherit',
        borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
        background: active ? 'var(--primary-soft)' : 'var(--surface)',
        color: active ? 'var(--primary)' : 'var(--ink-2)',
        fontWeight: active ? 700 : 550,
        opacity: disabled && !active ? 0.55 : 1,
        transition: 'background .12s, border-color .12s',
      }}
    >
      {children}
    </button>
  );
}

/** Bascule segmentée (ink / accent) — iso `.seg` du design. */
function Segmented({
  value, options, disabled, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            style={{
              height: 34, padding: '0 18px', border: 'none', fontFamily: 'inherit', fontSize: 13,
              fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
              background: on ? 'var(--primary)' : 'transparent',
              color: on ? '#fff' : 'var(--ink-3)',
              opacity: disabled && !on ? 0.55 : 1,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Rangée de pastilles de couleur (logo fond / signe). */
function SwatchRow({
  value, options, disabled, onChange, ariaLabel,
}: {
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((hex) => {
        const on = value.toLowerCase() === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={hex}
            title={hex}
            onClick={() => onChange(hex)}
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
              background: hex,
              border: on ? '2px solid var(--ink)' : '2px solid var(--border)',
              boxShadow: hex.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px var(--border)' : 'none',
              opacity: disabled && !on ? 0.55 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

export function AppearanceSettingsSection() {
  const { current, preview, save, saving } = useAppearance();
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const { t } = useT();

  // Brouillon local : initialisé depuis la valeur enregistrée, re-synchronisé si
  // elle change (autre onglet, refetch). On prévisualise à chaque modification.
  const [draft, setDraft] = useState<Appearance>(current);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated) {
      setDraft(current);
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hydrated]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(current);

  function patch(p: Partial<Appearance>) {
    const next = { ...draft, ...p };
    setDraft(next);
    preview(next); // aperçu instantané, non persisté
  }

  function reset() {
    setDraft(current);
    preview(current);
  }

  async function persist() {
    try {
      await save(draft);
      toast.success(t('settings.appearance.saved'));
    } catch {
      toast.error(t('settings.appearance.saveErr'));
    }
  }

  const locked = !isSuperAdmin;

  return (
    <Panel data-testid="appearance-settings">
      <PanelHeader>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('settings.appearance.title')} <SuperAdminBadge label={t('settings.superAdminBadge')} />
        </span>
      </PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {t('settings.appearance.hint')}
        </div>

        {locked && (
          <div
            role="note"
            style={{
              fontSize: 12, color: 'var(--ink-2)',
              background: 'var(--amber-soft, #fff4e0)', border: '1px solid var(--amber, #e0a23a)',
              borderRadius: 'var(--r-md, 8px)', padding: '8px 12px',
            }}
          >
            {t('settings.appearance.readonly')}
          </div>
        )}

        {/* Mode sombre */}
        <div>
          <SectionLabel>{t('settings.appearance.ambiance')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Chip active={!draft.dark} disabled={locked} onClick={() => patch({ dark: false })}>
              ☀️ {t('settings.appearance.light')}
            </Chip>
            <Chip active={draft.dark} disabled={locked} onClick={() => patch({ dark: true })}>
              🌙 {t('settings.appearance.dark')}
            </Chip>
          </div>
        </div>

        {/* Canvas (ambiance claire) */}
        <div>
          <SectionLabel>{t('settings.appearance.canvas')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: draft.dark ? 0.5 : 1 }}>
            {TONE_OPTIONS.map((o) => {
              const tone = TONES[o.value];
              return (
                <Chip
                  key={o.value}
                  active={draft.tone === o.value}
                  disabled={locked || draft.dark}
                  onClick={() => patch({ tone: o.value })}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 14, height: 14, borderRadius: 4,
                      background: tone.bg, border: `1px solid ${tone.border}`, flexShrink: 0,
                    }}
                  />
                  {t(o.labelKey)}
                </Chip>
              );
            })}
          </div>
          {draft.dark && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 6 }}>
              {t('settings.appearance.canvasDarkNote')}
            </div>
          )}
        </div>

        {/* Accent */}
        <div>
          <SectionLabel>{t('settings.appearance.accent')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENT_OPTIONS.map((o) => {
              const active = draft.accent.toLowerCase() === o.value.toLowerCase();
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={locked}
                  aria-pressed={active}
                  aria-label={t(o.labelKey)}
                  title={t(o.labelKey)}
                  onClick={() => patch({ accent: o.value })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 13px 7px 9px', fontSize: 13, fontFamily: 'inherit',
                    borderRadius: 999, cursor: locked ? 'not-allowed' : 'pointer',
                    border: active ? '1px solid var(--ink-2)' : '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--ink-2)',
                    fontWeight: active ? 700 : 550, opacity: locked && !active ? 0.55 : 1,
                  }}
                >
                  <span aria-hidden style={{
                    width: 16, height: 16, borderRadius: '50%', background: o.value,
                    border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0,
                  }} />
                  {t(o.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Police */}
        <div>
          <SectionLabel>{t('settings.appearance.font')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FONT_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={draft.font === o.value}
                disabled={locked}
                onClick={() => patch({ font: o.value })}
              >
                <span style={{ fontFamily: o.stack }}>{o.labelKey ? t(o.labelKey) : o.label}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* Nav active (ink / accent) */}
        <div>
          <SectionLabel>{t('settings.appearance.navActive')}</SectionLabel>
          <Segmented
            value={draft.navActive}
            disabled={locked}
            options={ROLE_FILL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            onChange={(v) => patch({ navActive: v as Appearance['navActive'] })}
          />
        </div>

        {/* Boutons (ink / accent) */}
        <div>
          <SectionLabel>{t('settings.appearance.buttons')}</SectionLabel>
          <Segmented
            value={draft.btnPrimary}
            disabled={locked}
            options={ROLE_FILL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            onChange={(v) => patch({ btnPrimary: v as Appearance['btnPrimary'] })}
          />
        </div>

        {/* Logo : marque + fond + signe */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>{t('settings.appearance.logo')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LOGO_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={draft.logo === o.value}
                disabled={locked}
                onClick={() => patch({ logo: o.value })}
              >
                {t(o.labelKey)}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <SectionLabel>{t('settings.appearance.logoBg')}</SectionLabel>
              <SwatchRow
                value={draft.logoBg}
                options={LOGO_BG_OPTIONS}
                disabled={locked}
                ariaLabel={t('settings.appearance.logoBg')}
                onChange={(v) => patch({ logoBg: v })}
              />
            </div>
            <div>
              <SectionLabel>{t('settings.appearance.logoFg')}</SectionLabel>
              <SwatchRow
                value={draft.logoFg}
                options={LOGO_FG_OPTIONS}
                disabled={locked}
                ariaLabel={t('settings.appearance.logoFg')}
                onChange={(v) => patch({ logoFg: v })}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        {!locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void persist()}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            {dirty && (
              <Button variant="ghost" disabled={saving} onClick={reset}>
                {t('settings.appearance.reset')}
              </Button>
            )}
            {dirty && (
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                {t('settings.appearance.unsaved')}
              </span>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
