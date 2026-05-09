/**
 * Panel "Visibilité des patients sans médecin référent vaccination" (V036).
 *
 * S'affiche uniquement si le cloisonnement est activé. Permet à l'ADMIN
 * de cocher les rôles autorisés à voir, dans la queue Vaccination, les
 * patients qu'aucun médecin n'a encore pris en charge (= aucune dose
 * n'a été enregistrée par personne pour ce patient).
 *
 * Default = tous cochés → comportement historique préservé.
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
  type OrphanRole,
} from '../hooks/useAgendaIsolation';
import { usePractitioners } from '../hooks/usePractitioners';

const ROLES: { code: OrphanRole; label: string }[] = [
  { code: 'MEDECIN', label: 'Médecin' },
  { code: 'ADMIN', label: 'Administrateur' },
  { code: 'SECRETAIRE', label: 'Secrétaire' },
  { code: 'ASSISTANT', label: 'Assistant(e)' },
];

export function VaccinationOrphanRolesPanel() {
  const { practitioners } = usePractitioners();
  const { settings, agendaStrictIsolation, vaccinationOrphanVisibleRoles, isLoading } =
    useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();
  const isAdmin = useAuthStore((s) => s.user?.roles.includes('ADMIN') ?? false);

  // Auto-hide quand <2 médecins actifs OU cloisonnement OFF (le réglage n'a aucun effet).
  const activeCount = practitioners.filter((p) => p.active).length;
  if (activeCount < 2) return null;
  if (!agendaStrictIsolation) return null;

  async function toggleRole(role: OrphanRole, next: boolean) {
    if (!settings) {
      toast.error('Paramètres cabinet non chargés.');
      return;
    }
    const current = new Set(vaccinationOrphanVisibleRoles);
    if (next) current.add(role);
    else current.delete(role);
    try {
      await updateAgendaIsolation({
        settings,
        vaccinationOrphanVisibleRoles: Array.from(current),
      });
      toast.success(
        next
          ? `${role} : peut voir les patients sans médecin référent.`
          : `${role} : ne voit plus les patients sans médecin référent.`,
      );
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(
        problem.title,
        problem.detail ? { description: problem.detail } : undefined,
      );
    }
  }

  return (
    <Panel data-testid="vaccination-orphan-roles">
      <PanelHeader>Patients sans médecin référent (vaccination)</PanelHeader>
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-3)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Quand le cloisonnement est activé, choisir les rôles qui voient dans
          la queue Vaccination les patients qu'aucun médecin n'a encore pris en
          charge. Un médecin devient référent dès qu'il enregistre une action
          (administration, report, planification) sur une dose du patient.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROLES.map((r) => {
            const checked = vaccinationOrphanVisibleRoles.includes(r.code);
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
                  aria-label={`Visibilité orphelins pour ${r.label}`}
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
