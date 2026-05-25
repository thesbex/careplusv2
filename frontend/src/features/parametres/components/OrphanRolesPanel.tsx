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
import {
  useAgendaIsolation,
  useUpdateAgendaIsolation,
  type OrphanModule,
  type OrphanRole,
} from '../hooks/useAgendaIsolation';
import { usePractitioners } from '../hooks/usePractitioners';

const ROLES: { code: OrphanRole; label: string }[] = [
  { code: 'MEDECIN', label: 'Médecin' },
  { code: 'ADMIN', label: 'Administrateur' },
  { code: 'SECRETAIRE', label: 'Secrétaire' },
  { code: 'ASSISTANT', label: 'Assistant(e)' },
];

interface ModuleCopy {
  title: string;
  description: string;
  toastEnabled: (role: OrphanRole) => string;
  toastDisabled: (role: OrphanRole) => string;
  testId: string;
}

const COPY: Record<OrphanModule, ModuleCopy> = {
  vaccination: {
    title: 'Patients sans médecin référent (vaccination)',
    description:
      "Quand le cloisonnement est activé, choisir les rôles qui voient dans la queue Vaccination les patients qu'aucun médecin n'a encore pris en charge. Un médecin devient référent dès qu'il enregistre une action (administration, report, planification) sur une dose du patient.",
    toastEnabled: (r) => `${r} : peut voir les patients sans médecin référent vaccination.`,
    toastDisabled: (r) => `${r} : ne voit plus les patients sans médecin référent vaccination.`,
    testId: 'vaccination-orphan-roles',
  },
  pregnancy: {
    title: 'Grossesses sans médecin référent',
    description:
      "Quand le cloisonnement est activé, choisir les rôles qui voient dans la queue Grossesse les patientes qu'aucun médecin n'a encore prises en charge. Un médecin devient référent dès qu'il déclare la grossesse, enregistre une visite obstétricale, une échographie ou un plan de visite.",
    toastEnabled: (r) => `${r} : peut voir les grossesses sans médecin référent.`,
    toastDisabled: (r) => `${r} : ne voit plus les grossesses sans médecin référent.`,
    testId: 'pregnancy-orphan-roles',
  },
  hospitalization: {
    title: 'Séjours sans médecin référent',
    description:
      "Quand le cloisonnement est activé, choisir les rôles qui voient dans la liste des patients hospitalisés les séjours sans médecin responsable. Un médecin est référent s'il est le médecin responsable du séjour (saisi à l'admission).",
    toastEnabled: (r) => `${r} : peut voir les séjours sans médecin référent.`,
    toastDisabled: (r) => `${r} : ne voit plus les séjours sans médecin référent.`,
    testId: 'hospitalization-orphan-roles',
  },
};

interface Props {
  module: OrphanModule;
}

export function OrphanRolesPanel({ module }: Props) {
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

  const copy = COPY[module];
  const currentRoles =
    module === 'vaccination'
      ? vaccinationOrphanVisibleRoles
      : module === 'pregnancy'
      ? pregnancyOrphanVisibleRoles
      : hospitalizationOrphanVisibleRoles;

  async function toggleRole(role: OrphanRole, next: boolean) {
    if (!settings) {
      toast.error('Paramètres cabinet non chargés.');
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
      toast.success(next ? copy.toastEnabled(role) : copy.toastDisabled(role));
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(
        problem.title,
        problem.detail ? { description: problem.detail } : undefined,
      );
    }
  }

  return (
    <Panel data-testid={copy.testId}>
      <PanelHeader>{copy.title}</PanelHeader>
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-3)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {copy.description}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROLES.map((r) => {
            const checked = currentRoles.includes(r.code);
            return (
              <label
                key={r.code}
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
                  onChange={(e) => void toggleRole(r.code, e.target.checked)}
                  aria-label={`Visibilité orphelins ${module} pour ${r.label}`}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13 }}>{r.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
