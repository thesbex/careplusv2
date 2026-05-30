/**
 * Panel "Visibilité des patients/grossesses sans médecin référent".
 *
 * Paramétrable via `module` :
 *   - 'vaccination' (V036) — pilote configuration_clinic_settings.vaccination_orphan_visible_roles
 *   - 'pregnancy'   (V039) — pilote configuration_clinic_settings.pregnancy_orphan_visible_roles
 *
 * S'affiche uniquement si le cloisonnement est activé ET ≥ 2 médecins actifs
 * (sinon le réglage n'a aucun effet, AccessScopeService bypasse).
 *
 * Cocher / décocher déclenche un PUT direct (pas de bouton « Enregistrer »).
 */
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useAgendaIsolation,
  useUpdateAgendaIsolation,
  type OrphanModule,
  type OrphanRole,
} from '../hooks/useAgendaIsolation';
import { usePractitioners } from '../hooks/usePractitioners';

const ROLE_CODES: OrphanRole[] = ['MEDECIN', 'ADMIN', 'SECRETAIRE', 'ASSISTANT'];

/** Sous-libellés (variante calm) — contexte hospitalisation (séjours). */
const SUBLABEL: Record<OrphanRole, string> = {
  MEDECIN: 'Voit tous les séjours',
  ADMIN: 'Accès complet · supervision',
  SECRETAIRE: 'Limité au médecin référent',
  ASSISTANT: 'Limité au médecin référent',
};

/** module → (préfixe de clé i18n, data-testid). */
const MODULE_META: Record<OrphanModule, { prefix: string; testId: string }> = {
  vaccination: { prefix: 'settings.orphan.vacc', testId: 'vaccination-orphan-roles' },
  pregnancy: { prefix: 'settings.orphan.preg', testId: 'pregnancy-orphan-roles' },
  hospitalization: { prefix: 'settings.orphan.hosp', testId: 'hospitalization-orphan-roles' },
};

interface Props {
  module: OrphanModule;
  /** Variante « Calm Premium » (carte sans bordure + cases-cartes) — écran Chambres & lits. */
  calm?: boolean;
  /** Numéro de section affiché en variante calm (ex. « 06 »). */
  sectionNumber?: string;
}

export function OrphanRolesPanel({ module, calm = false, sectionNumber = '06' }: Props) {
  const { t } = useT();
  const { practitioners } = usePractitioners();
  const {
    settings,
    agendaStrictIsolation,
    vaccinationOrphanVisibleRoles,
    pregnancyOrphanVisibleRoles,
    hospitalizationOrphanVisibleRoles,
    isLoading,
  } = useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();
  const isAdmin = useAuthStore((s) => s.user?.roles.includes('ADMIN') ?? false);

  // Auto-hide quand <2 médecins actifs OU cloisonnement OFF (le réglage n'a aucun effet).
  const activeCount = practitioners.filter((p) => p.active).length;
  if (activeCount < 2) return null;
  if (!agendaStrictIsolation) return null;

  const meta = MODULE_META[module];
  const currentRoles =
    module === 'vaccination'
      ? vaccinationOrphanVisibleRoles
      : module === 'pregnancy'
      ? pregnancyOrphanVisibleRoles
      : hospitalizationOrphanVisibleRoles;

  async function toggleRole(role: OrphanRole, next: boolean) {
    if (!settings) {
      toast.error(t('settings.notLoaded'));
      return;
    }
    const updated = new Set(currentRoles);
    if (next) updated.add(role);
    else updated.delete(role);
    const nextArray = Array.from(updated);
    try {
      await updateAgendaIsolation({
        settings,
        ...(module === 'vaccination'
          ? { vaccinationOrphanVisibleRoles: nextArray }
          : module === 'pregnancy'
          ? { pregnancyOrphanVisibleRoles: nextArray }
          : { hospitalizationOrphanVisibleRoles: nextArray }),
      });
      toast.success(t(`${meta.prefix}.${next ? 'on' : 'off'}`, { role: t(`role.${role}`) }));
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(
        problem.title,
        problem.detail ? { description: problem.detail } : undefined,
      );
    }
  }

  // Variante « Calm Premium » — section sans carte bordée + cases-cartes,
  // iso aux panneaux 01-05 de l'écran Chambres & lits (panel 06).
  if (calm) {
    return (
      <section className="cl-panel" data-testid={meta.testId}>
        <div className="cl-panel-h">
          <span className="ix">{sectionNumber}</span>
          <h3>{t(`${meta.prefix}.title`)}</h3>
          <span className="meta">· cloisonnement</span>
        </div>
        <div className="cl-panel-b">
          <p className="cl-help" style={{ margin: 0, maxWidth: 620 }}>{t(`${meta.prefix}.desc`)}</p>
          <div className="cl-ck-grid">
            {ROLE_CODES.map((code) => {
              const checked = currentRoles.includes(code);
              const label = t(`role.${code}`);
              return (
                <label key={code} className={`cl-ck${checked ? ' on' : ''}`}
                  style={{ cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                  <input type="checkbox" checked={checked}
                    disabled={!isAdmin || isPending || isLoading}
                    onChange={(e) => void toggleRole(code, e.target.checked)}
                    aria-label={t('settings.orphan.aria', { module, role: label })}
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
                  <span className="box">
                    <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7.5 5.5 11 12 3.5" /></svg>
                  </span>
                  <span className="lab"><b>{label}</b><span>{SUBLABEL[code]}</span></span>
                </label>
              );
            })}
          </div>
          <div className="cl-save-hint"><span className="d" />Enregistré automatiquement</div>
        </div>
      </section>
    );
  }

  return (
    <Panel data-testid={meta.testId}>
      <PanelHeader>{t(`${meta.prefix}.title`)}</PanelHeader>
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-3)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {t(`${meta.prefix}.desc`)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROLE_CODES.map((code) => {
            const checked = currentRoles.includes(code);
            const label = t(`role.${code}`);
            return (
              <label
                key={code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: isAdmin ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isAdmin || isPending || isLoading}
                  onChange={(e) => void toggleRole(code, e.target.checked)}
                  aria-label={t('settings.orphan.aria', { module, role: label })}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13 }}>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
