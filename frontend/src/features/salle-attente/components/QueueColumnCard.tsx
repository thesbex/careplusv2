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
import { useT } from '@/lib/i18n/I18nProvider';
import type { QueueEntry, WaitingPatientStatus } from '../types';

const STATUS_KEY: Record<WaitingPatientStatus, string> = {
  consult: 'salle.status.consult',
  vitals: 'salle.status.vitals',
  waiting: 'salle.status.waiting',
  arrived: 'salle.status.arrived',
  done: 'salle.status.done',
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
  const { t } = useT();
  const waitedAmber = p.waited.includes('25');

  return (
    <div className="sa-col-card" role="listitem">
      <div className="sa-col-card-top">
        <Avatar initials={initials(p.name)} size="sm" />
        <div className="sa-col-card-id">
          <div className="sa-col-card-name">
            {p.isPremium && (
              <span
                title={t('salle.premiumTitle')}
                aria-label={t('salle.premiumTitle')}
                style={{ marginRight: 4 }}
              >
                🌟
              </span>
            )}
            {p.name}
          </div>
          <div className="sa-patient-meta">
            {p.age > 0 ? t('salle.years', { n: p.age }) : ''}
            {p.age > 0 && p.reason ? ' · ' : ''}
            {p.reason}
            {!p.age && !p.reason && '—'}
          </div>
        </div>
        <Pill status={p.status} dot>
          {t(STATUS_KEY[p.status])}
        </Pill>
      </div>

      {p.allergy && (
        <Pill status="allergy" className="sa-allergy-chip sa-col-card-allergy">
          <Warn /> {p.allergy}
        </Pill>
      )}

      <div className="sa-col-card-meta">
        <span className="tnum">
          {t('salle.rdvAt', { time: p.apt })}
          {p.durationMinutes ? ` (${t('salle.durationMin', { n: p.durationMinutes })})` : ''}
        </span>
        {p.arrived && p.arrived !== '—' && (
          <span className="tnum">· {t('salle.arrivedAt', { time: p.arrived })}</span>
        )}
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
            {t('salle.takeVitals')}
          </Button>
        )}
        {p.status === 'arrived' && p.patientId && (
          <Button
            size="sm"
            variant={canRecordVitals ? 'ghost' : 'primary'}
            disabled={busy}
            onClick={() => onStartConsult?.(p)}
            title={t('salle.sendToConsultTitle')}
          >
            {t('salle.sendToConsult')}
          </Button>
        )}
        {p.status === 'vitals' && p.patientId && (
          <Button size="sm" disabled={busy} onClick={() => onStartConsult?.(p)}>
            {t('salle.sendToConsult')}
          </Button>
        )}
        {p.status === 'consult' && (
          <Button size="sm" onClick={() => onOpenConsult?.(p)}>
            {t('salle.open')}
          </Button>
        )}
        {p.status === 'waiting' && <Button size="sm">{t('salle.call')}</Button>}
        {p.appointmentId && p.status !== 'consult' && p.status !== 'done' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onCancel?.(p)}
            aria-label={t('salle.removeFromList', { name: p.name })}
            style={{ color: 'var(--danger, #b91c1c)' }}
          >
            {t('salle.remove')}
          </Button>
        )}
        <Button size="sm" variant="ghost" iconOnly aria-label={t('salle.moreOptions')}>
          <MoreH />
        </Button>
      </div>
    </div>
  );
}
