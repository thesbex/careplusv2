/**
 * Toggle "Cloisonnement" (V032 agendas + V036 queue Vaccination).
 *
 * Auto-hide si <2 médecins actifs : un cabinet 1 médecin n'a aucun usage
 * pour la flag (impossible de cloisonner à 1).
 *
 * Quand activé :
 *  - chaque MEDECIN ne voit que son propre agenda + ses créneaux ;
 *  - chaque SECRETAIRE / ASSISTANT ne voit que les agendas et la file
 *    d'attente des médecins auxquels l'admin l'a explicitement assignée
 *    (cf. tab "Utilisateurs") ;
 *  - la queue Vaccination ne montre que les patients qu'il « suit » (au
 *    moins 1 action sur une dose) + les patients orphelins selon la
 *    configuration `vaccinationOrphanVisibleRoles`.
 * Désactivé (par défaut), tout est partagé — le mode pratique pour des
 * cabinets de 2-3 généralistes qui se coordonnent. Le toggle est honoré
 * côté backend (filtre + 403 sur scheduling/clinical), pas seulement IHM.
 */
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useAgendaIsolation,
  useUpdateAgendaIsolation,
} from '../hooks/useAgendaIsolation';
import { usePractitioners } from '../hooks/usePractitioners';

export function AgendaIsolationToggle() {
  const { t } = useT();
  const { practitioners } = usePractitioners();
  const { settings, agendaStrictIsolation, isLoading } = useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();
  const isAdminOrDoctor = useAuthStore(
    (s) =>
      (s.user?.roles.includes('ADMIN') ?? false) ||
      (s.user?.roles.includes('MEDECIN') ?? false),
  );

  // Auto-hide quand <2 médecins actifs.
  const activeCount = practitioners.filter((p) => p.active).length;
  if (activeCount < 2) return null;

  async function handleToggle(next: boolean) {
    if (!settings) {
      toast.error(t('settings.notLoaded'));
      return;
    }
    try {
      await updateAgendaIsolation({
        settings,
        agendaStrictIsolation: next,
      });
      toast.success(next ? t('settings.iso.onToast') : t('settings.iso.offToast'));
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  return (
    <Panel data-testid="agenda-isolation-toggle">
      <PanelHeader>{t('settings.iso.title')}</PanelHeader>
      <div style={{ padding: 16 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: isAdminOrDoctor ? 'pointer' : 'not-allowed',
          }}
        >
          <input
            type="checkbox"
            role="switch"
            checked={agendaStrictIsolation}
            disabled={!isAdminOrDoctor || isPending || isLoading}
            onChange={(e) => void handleToggle(e.target.checked)}
            aria-label={t('settings.iso.toggleAria')}
            style={{ width: 18, height: 18, marginTop: 2 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {agendaStrictIsolation ? t('settings.iso.on') : t('settings.iso.off')}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {t('settings.iso.hint')}
            </div>
          </div>
        </label>
      </div>
    </Panel>
  );
}
