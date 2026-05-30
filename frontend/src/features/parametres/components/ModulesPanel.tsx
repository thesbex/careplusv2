/**
 * V070 — Habilitation des modules par l'administrateur.
 *
 * Permet à l'admin d'activer / désactiver les fonctionnalités secondaires de
 * l'application (Vaccinations, Grossesses, Stock, Messages, Assistant IA,
 * Charges). Un module désactivé disparaît de la navigation (sidebar desktop +
 * menu mobile). Les modules cœur (agenda, patients, salle, consult, facturation,
 * catalogue, personnel, paramètres) ne sont pas débrayables ; l'hospitalisation
 * a sa propre capability (onglet Cabinet).
 *
 * Réservé à l'ADMIN. Le PUT renvoie l'identité inchangée (NotBlank backend +
 * garde super-admin V069 : aucun champ protégé modifié → autorisé pour un admin).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  useClinicSettings,
  TOGGLEABLE_MODULES,
  type ClinicSettings,
} from '../hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';

export function ModulesPanel() {
  const { settings } = useClinicSettings();
  const qc = useQueryClient();
  const { t } = useT();
  const isAdmin = useAuthStore((s) => s.hasRole('ADMIN'));
  const [saving, setSaving] = useState<string | null>(null);

  // Seul l'admin gère l'habilitation des modules.
  if (!isAdmin) return null;

  const disabled = settings?.disabledModules ?? [];

  async function toggle(moduleId: string, enable: boolean) {
    if (!settings) {
      toast.error(t('settings.notLoaded'));
      return;
    }
    const next = enable
      ? disabled.filter((m) => m !== moduleId)
      : Array.from(new Set([...disabled, moduleId]));
    setSaving(moduleId);
    try {
      // Identité inchangée (NotBlank backend) + nouvelle liste de modules.
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
          disabledModules: next,
        })
        .then((r) => r.data);
      qc.setQueryData(['clinic-settings'], updated);
      const label = t(`module.${moduleId}`);
      toast.success(
        enable
          ? t('settings.modules.enabled', { label })
          : t('settings.modules.disabled', { label }),
      );
    } catch {
      toast.error(t('settings.modules.updateErr'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel data-testid="modules-panel">
      <PanelHeader>{t('settings.modules.title')}</PanelHeader>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('settings.modules.hint')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TOGGLEABLE_MODULES.map((m) => {
            const enabled = !disabled.includes(m.id);
            const label = t(`module.${m.id}`);
            return (
              <label
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  disabled={saving === m.id}
                  onChange={(e) => void toggle(m.id, e.target.checked)}
                  aria-label={label}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11.5, color: enabled ? 'var(--success, #0e5b3e)' : 'var(--ink-3)' }}>
                  {enabled ? t('settings.modules.on') : t('settings.modules.off')}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
