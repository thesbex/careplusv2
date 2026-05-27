/**
 * QA9-11 fix — carte patient compacte pour la file d'attente en colonnes
 * par médecin (≥2 praticiens actifs).
 *
 * Le mode multi-médecin scinde l'écran en colonnes étroites (~300 px). Y
 * réutiliser la table plate à 8 colonnes provoquait des retours à la ligne et
 * des décalages de hauteur ingérables. On rend donc chaque patient sous forme
 * d'une carte verticale : identité + statut sur une ligne, méta sur la
 * deuxième, actions en pied. Mêmes callbacks que QueueRow (table plate solo).
 */
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { MoreH, Warn } from '@/components/icons';
import type { QueueEntry, WaitingPatientStatus } from '../types';

const STATUS_LABEL: Record<WaitingPatientStatus, string> = {
  consult: 'En consultation',
  vitals: 'En constantes',
  waiting: 'En attente',
  arrived: 'Arrivé',
  done: 'Terminé',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('');
}

interface QueueColumnCardProps {
  patient: QueueEntry;
  onTakeVitals?: (appointmentId: string) => void;
  onStartConsult?: (entry: QueueEntry) => void;
  onOpenConsult?: (entry: QueueEntry) => void;
  onCancel?: (entry: QueueEntry) => void;
  busy?: boolean;
  canRecordVitals?: boolean;
}

export function QueueColumnCard({
  patient: p,
  onTakeVitals,
  onStartConsult,
  onOpenConsult,
  onCancel,
  busy,
  canRecordVitals = true,
}: QueueColumnCardProps) {
  const waitedAmber = p.waited.includes('25');

  return (
    <div className="sa-col-card" role="listitem">
      <div className="sa-col-card-top">
        <Avatar initials={initials(p.name)} size="sm" />
        <div className="sa-col-card-id">
          <div className="sa-col-card-name">
            {p.isPremium && (
              <span title="Patient Premium" aria-label="Patient Premium" style={{ marginRight: 4 }}>
                🌟
              </span>
            )}
            {p.name}
          </div>
          <div className="sa-patient-meta">
            {p.age > 0 ? `${p.age} ans` : ''}
            {p.age > 0 && p.reason ? ' · ' : ''}
            {p.reason}
            {!p.age && !p.reason && '—'}
          </div>
        </div>
        <Pill status={p.status} dot>
          {STATUS_LABEL[p.status]}
        </Pill>
      </div>

      {p.allergy && (
        <Pill status="allergy" className="sa-allergy-chip sa-col-card-allergy">
          <Warn /> {p.allergy}
        </Pill>
      )}

      <div className="sa-col-card-meta">
        <span className="tnum">
          RDV {p.apt}
          {p.durationMinutes ? ` (${p.durationMinutes}min)` : ''}
        </span>
        {p.arrived && p.arrived !== '—' && <span className="tnum">· arrivé {p.arrived}</span>}
        {p.waited && p.waited !== '—' && (
          <span
            className="tnum"
            style={{
              color: waitedAmber ? 'var(--amber)' : undefined,
              fontWeight: waitedAmber ? 600 : undefined,
            }}
          >
            · {p.waited}
          </span>
        )}
        {p.room && p.room !== '—' && <span>· {p.room}</span>}
      </div>

      <div className="sa-col-card-actions">
        {p.status === 'arrived' && p.appointmentId && canRecordVitals && (
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => onTakeVitals?.(p.appointmentId!)}
          >
            Prendre constantes →
          </Button>
        )}
        {p.status === 'arrived' && p.patientId && (
          <Button
            size="sm"
            variant={canRecordVitals ? 'ghost' : 'primary'}
            disabled={busy}
            onClick={() => onStartConsult?.(p)}
            title="Démarrer la consultation sans saisir de constantes"
          >
            Envoyer en consult. →
          </Button>
        )}
        {p.status === 'vitals' && p.patientId && (
          <Button size="sm" disabled={busy} onClick={() => onStartConsult?.(p)}>
            Envoyer en consult. →
          </Button>
        )}
        {p.status === 'consult' && (
          <Button size="sm" onClick={() => onOpenConsult?.(p)}>
            Ouvrir
          </Button>
        )}
        {p.status === 'waiting' && <Button size="sm">Appeler</Button>}
        {p.appointmentId && p.status !== 'consult' && p.status !== 'done' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onCancel?.(p)}
            aria-label={`Retirer ${p.name} de la liste d'attente`}
            style={{ color: 'var(--danger, #b91c1c)' }}
          >
            Retirer
          </Button>
        )}
        <Button size="sm" variant="ghost" iconOnly aria-label="Plus d'options">
          <MoreH />
        </Button>
      </div>
    </div>
  );
}
