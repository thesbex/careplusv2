/**
 * « Ma pause déjeuner » (profil médecin) — V067.
 * Le médecin précise sa fenêtre de pause ; pendant celle-ci, la prise de RDV
 * est interdite (bloquée à la création/déplacement + exclue des créneaux).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  useLunchBreak,
  useSetLunchBreak,
  useClearLunchBreak,
} from '@/features/agenda/hooks/useLunchBreak';

export function LunchBreakSection({ practitionerId }: { practitionerId: string }) {
  const { lunchBreak, isLoading } = useLunchBreak(practitionerId);
  const { setLunchBreak, isPending: saving } = useSetLunchBreak(practitionerId);
  const { clearLunchBreak, isPending: clearing } = useClearLunchBreak(practitionerId);
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('14:00');

  useEffect(() => {
    if (lunchBreak) {
      setStart(lunchBreak.startTime.slice(0, 5));
      setEnd(lunchBreak.endTime.slice(0, 5));
    }
  }, [lunchBreak]);

  async function save() {
    if (end <= start) {
      toast.error("L'heure de fin doit être après l'heure de début.");
      return;
    }
    try {
      await setLunchBreak({ startTime: start, endTime: end });
      toast.success('Pause déjeuner enregistrée.');
    } catch {
      toast.error("Échec de l'enregistrement.");
    }
  }

  async function clear() {
    try {
      await clearLunchBreak();
      toast.success('Pause déjeuner retirée.');
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Ma pause déjeuner</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        Pendant cette plage, aucun rendez-vous ne peut être pris sur votre agenda (tous les jours travaillés).
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Début</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={timeInput}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Fin</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={timeInput}
              />
            </label>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {lunchBreak && (
              <Button disabled={clearing} onClick={() => void clear()}>
                Retirer
              </Button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>
            {lunchBreak
              ? `Pause active : ${lunchBreak.startTime.slice(0, 5)} – ${lunchBreak.endTime.slice(0, 5)}.`
              : 'Aucune pause configurée — les rendez-vous sont autorisés toute la journée.'}
          </div>
        </>
      )}
    </div>
  );
}

const timeInput: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 13,
  background: 'var(--surface)',
};
