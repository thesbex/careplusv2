import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel, FieldHelp } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Trash } from '@/components/icons';
import { useLeaves } from './hooks/useLeaves';
import { useCreateLeave } from './hooks/useCreateLeave';
import { useDeleteLeave } from './hooks/useDeleteLeave';
import './parametres.css';

const MONTHS_FR = [
  'jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.',
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

function isFuture(endDate: string): boolean {
  return new Date(endDate + 'T23:59:59') >= new Date();
}

export default function CongesPage() {
  const navigate = useNavigate();
  const { leaves, isLoading, error } = useLeaves();
  const { createLeave, isPending, error: createError } = useCreateLeave();
  const { deleteLeave, isDeletingId } = useDeleteLeave();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError('Veuillez renseigner les deux dates.');
      return;
    }
    if (endDate < startDate) {
      setFormError('La date de fin doit être après la date de début.');
      return;
    }
    await createLeave({ startDate, endDate, ...(reason ? { reason } : {}) }).catch(() => null);
    setStartDate('');
    setEndDate('');
    setReason('');
  }

  return (
    <Screen
      active="params"
      title="Paramètres"
      sub="Congés & absences"
      onNavigate={(id) => {
        const map = {
          agenda: '/agenda', patients: '/patients', salle: '/salle',
          consult: '/consultations', factu: '/facturation', catalogue: '/catalogue',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div className="params-sections">
        <section className="params-section">
          <div className="params-section-header">
            <div className="params-section-title">Congés & absences</div>
            <div className="params-section-sub">
              Les jours couverts par une période de congé sont automatiquement exclus du calendrier de prise de RDV.
            </div>
          </div>
          <div className="params-section-body">
            <form onSubmit={(e) => { void handleSubmit(e); }}>
              <div className="params-leave-form">
                <Field>
                  <FieldLabel htmlFor="leave-start">Date de début</FieldLabel>
                  <Input
                    id="leave-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leave-end">Date de fin</FieldLabel>
                  <Input
                    id="leave-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leave-reason">Motif (facultatif)</FieldLabel>
                  <Input
                    id="leave-reason"
                    placeholder="Congé annuel, formation…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>&nbsp;</FieldLabel>
                  <Button type="submit" variant="primary" disabled={isPending}>
                    {isPending ? 'Ajout…' : 'Ajouter'}
                  </Button>
                </Field>
              </div>
              {(formError ?? createError) && (
                <FieldHelp style={{ color: 'var(--danger)', marginBottom: 12 }}>
                  {formError ?? createError}
                </FieldHelp>
              )}
            </form>

            <div className="params-leave-list">
              {isLoading && (
                <div className="params-leave-empty">Chargement…</div>
              )}
              {error && (
                <div className="params-leave-empty" style={{ color: 'var(--danger)' }}>{error}</div>
              )}
              {!isLoading && !error && leaves.length === 0 && (
                <div className="params-leave-empty">Aucun congé déclaré.</div>
              )}
              {leaves.map((l) => {
                const upcoming = isFuture(l.endDate);
                return (
                  <div key={l.id} className="params-leave-row">
                    <div className="params-leave-period">
                      {formatDate(l.startDate)}
                      {l.startDate !== l.endDate && ` → ${formatDate(l.endDate)}`}
                    </div>
                    <div className="params-leave-reason">{l.reason ?? ''}</div>
                    <span className={`params-leave-badge${upcoming ? '' : ' past'}`}>
                      {upcoming ? 'À venir' : 'Passé'}
                    </span>
                    <Button
                      variant="ghost"
                      iconOnly
                      size="sm"
                      aria-label="Supprimer ce congé"
                      disabled={isDeletingId === l.id}
                      onClick={() => { void deleteLeave(l.id); }}
                    >
                      <Trash />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </Screen>
  );
}
