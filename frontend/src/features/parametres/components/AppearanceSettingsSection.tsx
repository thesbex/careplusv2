/**
 * Apparence (V072 + V073) — panneau « Tweaks » de la maquette « calm premium » :
 * police · ambiance (canvas) · accent · mode sombre · nav/boutons · logo.
 *
 * V073 — chaque utilisateur personnalise SON affichage :
 *  • « Mon apparence » (override perso) est éditable par TOUS les utilisateurs ;
 *  • « Apparence par défaut du cabinet » (V072) reste réservée au SUPER_ADMIN et
 *    sert de base aux utilisateurs sans override.
 * Résolution effective : override perso → défaut cabinet → défaut app
 * (cf. AppearanceProvider). L'aperçu est instantané ; la persistance explicite.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useAppearance } from '../hooks/useAppearance';
import { useMyAppearance } from '../hooks/useMyAppearance';
import {
  ACCENT_OPTIONS,
  applyAppearance,
  FONT_OPTIONS,
  LOGO_BG_OPTIONS,
  LOGO_FG_OPTIONS,
  LOGO_OPTIONS,
  ROLE_FILL_OPTIONS,
  serializeAppearance,
  TONE_OPTIONS,
  TONES,
  type Appearance,
} from '@/lib/theme/appearance';

function SuperAdminBadge({ label }: { label: string }) {
  const { t } = useT();
  return (
    <span
      title={t('settings.superAdminTooltip')}
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

/** Les contrôles d'apparence — présentationnel, piloté par `value` / `onPatch`. */
function AppearanceControls({
  value, onPatch, disabled,
}: {
  value: Appearance;
  onPatch: (p: Partial<Appearance>) => void;
  disabled: boolean;
}) {
  const { t } = useT();
  return (
    <>
      {/* Mode sombre */}
      <div>
        <SectionLabel>{t('settings.appearance.ambiance')}</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Chip active={!value.dark} disabled={disabled} onClick={() => onPatch({ dark: false })}>
            ☀️ {t('settings.appearance.light')}
          </Chip>
          <Chip active={value.dark} disabled={disabled} onClick={() => onPatch({ dark: true })}>
            🌙 {t('settings.appearance.dark')}
          </Chip>
        </div>
      </div>

      {/* Canvas (ambiance claire) */}
      <div>
        <SectionLabel>{t('settings.appearance.canvas')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: value.dark ? 0.5 : 1 }}>
          {TONE_OPTIONS.map((o) => {
            const tone = TONES[o.value];
            return (
              <Chip
                key={o.value}
                active={value.tone === o.value}
                disabled={disabled || value.dark}
                onClick={() => onPatch({ tone: o.value })}
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
        {value.dark && (
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
            const active = value.accent.toLowerCase() === o.value.toLowerCase();
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={t(o.labelKey)}
                title={t(o.labelKey)}
                onClick={() => onPatch({ accent: o.value })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 13px 7px 9px', fontSize: 13, fontFamily: 'inherit',
                  borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
                  border: active ? '1px solid var(--ink-2)' : '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--ink-2)',
                  fontWeight: active ? 700 : 550, opacity: disabled && !active ? 0.55 : 1,
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
              active={value.font === o.value}
              disabled={disabled}
              onClick={() => onPatch({ font: o.value })}
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
          value={value.navActive}
          disabled={disabled}
          options={ROLE_FILL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(v) => onPatch({ navActive: v as Appearance['navActive'] })}
        />
      </div>

      {/* Boutons (ink / accent) */}
      <div>
        <SectionLabel>{t('settings.appearance.buttons')}</SectionLabel>
        <Segmented
          value={value.btnPrimary}
          disabled={disabled}
          options={ROLE_FILL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(v) => onPatch({ btnPrimary: v as Appearance['btnPrimary'] })}
        />
      </div>

      {/* Logo : marque + fond + signe */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionLabel>{t('settings.appearance.logo')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LOGO_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={value.logo === o.value}
              disabled={disabled}
              onClick={() => onPatch({ logo: o.value })}
            >
              {t(o.labelKey)}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <SectionLabel>{t('settings.appearance.logoBg')}</SectionLabel>
            <SwatchRow
              value={value.logoBg}
              options={LOGO_BG_OPTIONS}
              disabled={disabled}
              ariaLabel={t('settings.appearance.logoBg')}
              onChange={(v) => onPatch({ logoBg: v })}
            />
          </div>
          <div>
            <SectionLabel>{t('settings.appearance.logoFg')}</SectionLabel>
            <SwatchRow
              value={value.logoFg}
              options={LOGO_FG_OPTIONS}
              disabled={disabled}
              ariaLabel={t('settings.appearance.logoFg')}
              onChange={(v) => onPatch({ logoFg: v })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Un éditeur d'apparence pour une portée (perso ou cabinet). Gère le brouillon
 * local, l'aperçu instantané et la persistance explicite. `onResetToCabinet` /
 * `hasOverride` ne sont fournis que pour la portée personnelle.
 */
function AppearanceEditor({
  testId, title, hint, badge, current, saving, onSave, hasOverride, onResetToCabinet,
}: {
  testId: string;
  title: string;
  hint: string;
  badge?: React.ReactNode;
  current: Appearance;
  saving: boolean;
  onSave: (next: Appearance) => Promise<void>;
  hasOverride?: boolean;
  onResetToCabinet?: () => Promise<void>;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<Appearance>(current);

  const currentKey = serializeAppearance(current);
  const dirty = serializeAppearance(draft) !== currentKey;
  // Re-synchronise le brouillon quand la valeur ENREGISTRÉE change (chargement
  // async, save, refetch) — jamais pendant l'édition, pour ne pas écraser les
  // modifs en cours.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) setDraft(JSON.parse(currentKey) as Appearance);
  }, [currentKey]);

  function patch(p: Partial<Appearance>) {
    const next = { ...draft, ...p };
    setDraft(next);
    applyAppearance(next); // aperçu instantané, non persisté
  }

  function discard() {
    setDraft(current);
    applyAppearance(current);
  }

  async function persist() {
    try {
      await onSave(draft);
      toast.success(t('settings.appearance.saved'));
    } catch {
      toast.error(t('settings.appearance.saveErr'));
    }
  }

  async function resetToCabinet() {
    if (!onResetToCabinet) return;
    try {
      await onResetToCabinet();
      toast.success(t('settings.appearance.resetDone'));
    } catch {
      toast.error(t('settings.appearance.saveErr'));
    }
  }

  return (
    <Panel data-testid={testId}>
      <PanelHeader>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {title} {badge}
        </span>
      </PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{hint}</div>

        {onResetToCabinet && !hasOverride && (
          <div role="note" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {t('settings.appearance.usingCabinet')}
          </div>
        )}

        <AppearanceControls value={draft} onPatch={patch} disabled={false} />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={!dirty || saving} onClick={() => void persist()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
          {dirty && (
            <Button variant="ghost" disabled={saving} onClick={discard}>
              {t('settings.appearance.reset')}
            </Button>
          )}
          {onResetToCabinet && hasOverride && !dirty && (
            <Button variant="ghost" disabled={saving} onClick={() => void resetToCabinet()}>
              {t('settings.appearance.resetToCabinet')}
            </Button>
          )}
          {dirty && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
              {t('settings.appearance.unsaved')}
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function AppearanceSettingsSection() {
  const { t } = useT();
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const personal = useMyAppearance();
  const cabinet = useAppearance();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mon apparence — éditable par tous (V073). */}
      <AppearanceEditor
        testId="appearance-settings"
        title={t('settings.appearance.myTitle')}
        hint={t('settings.appearance.personalHint')}
        current={personal.current}
        saving={personal.saving}
        onSave={personal.save}
        hasOverride={personal.hasOverride}
        onResetToCabinet={personal.resetToCabinet}
      />

      {/* Défaut cabinet — réservé super admin (V072). */}
      {isSuperAdmin && (
        <AppearanceEditor
          testId="appearance-settings-cabinet"
          title={t('settings.appearance.cabinetTitle')}
          hint={t('settings.appearance.hint')}
          badge={<SuperAdminBadge label={t('settings.superAdminBadge')} />}
          current={cabinet.current}
          saving={cabinet.saving}
          onSave={cabinet.save}
        />
      )}
    </div>
  );
}
