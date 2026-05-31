import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useT } from '@/lib/i18n/I18nProvider';
import { usePatientSearch } from '../prise-rdv/hooks/usePatientSearch';
import {
  EMPTY_FILTERS,
  paymentModeKey,
  type DateField,
  type InvoiceSearchFilters,
  type PaymentMode,
} from './types';

interface Props {
  filters: InvoiceSearchFilters;
  onChange: (next: InvoiceSearchFilters) => void;
}

const MODES: PaymentMode[] = ['ESPECES', 'CHEQUE', 'CB', 'VIREMENT', 'TIERS_PAYANT'];

function activeFilterCount(f: InvoiceSearchFilters): number {
  let n = 0;
  if (f.from || f.to) n++;
  if (f.dateField !== 'ISSUED') n++;
  if (f.paymentModes.length) n++;
  if (f.patientId) n++;
  if (f.amountMin !== null || f.amountMax !== null) n++;
  return n;
}

export function AdvancedFiltersPopover({ filters, onChange }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceSearchFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function applyPreset(preset: 'thisMonth' | 'lastMonth' | 'thisYear') {
    const today = new Date();
    let from: Date;
    let to: Date;
    if (preset === 'thisMonth') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'lastMonth') {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
      to = new Date(today.getFullYear(), 11, 31);
    }
    setDraft({ ...draft, from: toIso(from), to: toIso(to) });
  }

  const count = activeFilterCount(filters);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="fa-filter-btn" aria-haspopup="dialog">
          {count > 0 ? t('factu.adv.triggerCount', { n: count }) : t('factu.adv.trigger')}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="fa-filters-popover"
          sideOffset={6}
          align="end"
          aria-label={t('factu.adv.aria')}
        >
          <div className="fa-fp-section">
            <div className="fa-fp-label">{t('factu.adv.dateField')}</div>
            <div className="fa-fp-radios">
              {(['ISSUED', 'PAID'] as DateField[]).map((f) => (
                <label key={f} className="fa-fp-radio">
                  <input
                    type="radio"
                    name="dateField"
                    value={f}
                    checked={draft.dateField === f}
                    onChange={() => setDraft({ ...draft, dateField: f })}
                  />
                  {f === 'ISSUED' ? t('factu.adv.issued') : t('factu.adv.paid')}
                </label>
              ))}
            </div>
            <div className="fa-fp-row">
              <label>
                {t('factu.adv.from')}
                <input
                  type="date"
                  value={draft.from ?? ''}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value || null })}
                />
              </label>
              <label>
                {t('factu.adv.to')}
                <input
                  type="date"
                  value={draft.to ?? ''}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value || null })}
                />
              </label>
            </div>
            <div className="fa-fp-presets">
              <button type="button" onClick={() => applyPreset('thisMonth')}>
                {t('factu.adv.preset.thisMonth')}
              </button>
              <button type="button" onClick={() => applyPreset('lastMonth')}>
                {t('factu.adv.preset.lastMonth')}
              </button>
              <button type="button" onClick={() => applyPreset('thisYear')}>
                {t('factu.adv.preset.thisYear')}
              </button>
            </div>
          </div>

          <div className="fa-fp-section">
            <div className="fa-fp-label">{t('factu.adv.paymentModes')}</div>
            <div className="fa-fp-checkbox-grid">
              {MODES.map((m) => (
                <label key={m} className="fa-fp-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.paymentModes.includes(m)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...draft.paymentModes, m]
                        : draft.paymentModes.filter((x) => x !== m);
                      setDraft({ ...draft, paymentModes: next });
                    }}
                  />
                  {t(paymentModeKey(m))}
                </label>
              ))}
            </div>
          </div>

          <PatientPicker
            value={draft.patientId}
            onChange={(id) => setDraft({ ...draft, patientId: id })}
          />

          <div className="fa-fp-section">
            <div className="fa-fp-label">{t('factu.adv.amount')}</div>
            <div className="fa-fp-row">
              <label>
                {t('factu.adv.min')}
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={draft.amountMin ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, amountMin: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
              <label>
                {t('factu.adv.max')}
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={draft.amountMax ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, amountMax: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
            </div>
          </div>

          <div className="fa-fp-actions">
            <button
              type="button"
              className="fa-fp-reset"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                onChange({ ...EMPTY_FILTERS, statuses: filters.statuses });
                setOpen(false);
              }}
            >
              {t('factu.adv.reset')}
            </button>
            <button
              type="button"
              className="fa-fp-apply"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {t('factu.adv.apply')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PatientPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const { candidates } = usePatientSearch(query);
  const selected = value ? candidates.find((c) => c.id === value) : null;

  return (
    <div className="fa-fp-section">
      <div className="fa-fp-label">{t('factu.adv.patient')}</div>
      {value && selected ? (
        <div className="fa-fp-selected">
          <span>{selected.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label={t('factu.adv.removePatient')}>
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder={t('factu.adv.patientPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {candidates.length > 0 && (
            <ul className="fa-fp-suggest">
              {candidates.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange(c.id); setQuery(c.name); }}>
                    {c.name}
                    <span>{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function toIso(d: Date): string {
  // Use local components: toISOString() returns UTC and would shift dates
  // back one day in zones east of UTC (e.g. Africa/Casablanca, UTC+1).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
