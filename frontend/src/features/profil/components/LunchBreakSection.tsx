/**
 * « Ma pause déjeuner » (profil médecin) — V067.
 * Le médecin précise sa fenêtre de pause ; pendant celle-ci, la prise de RDV
 * est interdite (bloquée à la création/déplacement + exclue des créneaux).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useLunchBreak,
  useSetLunchBreak,
  useClearLunchBreak,
} from '@/features/agenda/hooks/useLunchBreak';

export function LunchBreakSection({ practitionerId }: { practitionerId: string }) {
  const { t } = useT();
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
      toast.error(t('profil.lunch.errEndAfterStart'));
      return;
    }
    try {
      await setLunchBreak({ startTime: start, endTime: end });
      toast.success(t('profil.lunch.saved'));
    } catch {
      toast.error(t('profil.lunch.saveFailed'));
    }
  }

  async function clear() {
    try {
      await clearLunchBreak();
      toast.success(t('profil.lunch.removed'));
    } catch {
      toast.error(t('profil.lunch.removeFailed'));
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
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t('profil.lunch.title')}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        {t('profil.lunch.hint')}
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t('profil.lunch.loading')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('profil.lunch.start')}</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={timeInput}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('profil.lunch.end')}</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={timeInput}
              />
            </label>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('profil.lunch.saving') : t('profil.lunch.save')}
            </Button>
            {lunchBreak && (
              <Button disabled={clearing} onClick={() => void clear()}>
                {t('profil.lunch.remove')}
              </Button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>
            {lunchBreak
              ? t('profil.lunch.active', { start: lunchBreak.startTime.slice(0, 5), end: lunchBreak.endTime.slice(0, 5) })
              : t('profil.lunch.none')}
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
