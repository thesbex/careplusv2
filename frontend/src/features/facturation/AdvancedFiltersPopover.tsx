import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { usePatientSearch } from '../prise-rdv/hooks/usePatientSearch';
import {
  EMPTY_FILTERS,
  PAYMENT_MODE_LABEL,
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
          Filtres avancés{count > 0 ? ` (${count})` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="fa-filters-popover"
          sideOffset={6}
          align="end"
          aria-label="Filtres avancés"
        >
          <div className="fa-fp-section">
            <div className="fa-fp-label">Date à appliquer</div>
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
                  {f === 'ISSUED' ? 'Émission' : 'Encaissement'}
                </label>
              ))}
            </div>
            <div className="fa-fp-row">
              <label>
                Du
                <input
                  type="date"
                  value={draft.from ?? ''}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value || null })}
                />
              </label>
              <label>
                Au
                <input
                  type="date"
                  value={draft.to ?? ''}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value || null })}
                />
              </label>
            </div>
            <div className="fa-fp-presets">
              <button type="button" onClick={() => applyPreset('thisMonth')}>
                Ce mois
              </button>
              <button type="button" onClick={() => applyPreset('lastMonth')}>
                Mois dernier
              </button>
              <button type="button" onClick={() => applyPreset('thisYear')}>
                Cette année
              </button>
            </div>
          </div>

          <div className="fa-fp-section">
            <div className="fa-fp-label">Modes de paiement</div>
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
                  {PAYMENT_MODE_LABEL[m]}
                </label>
              ))}
            </div>
          </div>

          <PatientPicker
            value={draft.patientId}
            onChange={(id) => setDraft({ ...draft, patientId: id })}
          />

          <div className="fa-fp-section">
            <div className="fa-fp-label">Montant net (MAD)</div>
            <div className="fa-fp-row">
              <label>
                Min
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
                Max
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
              Réinitialiser
            </button>
            <button
              type="button"
              className="fa-fp-apply"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Appliquer
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
  const [query, setQuery] = useState('');
  const { candidates } = usePatientSearch(query);
  const selected = value ? candidates.find((c) => c.id === value) : null;

  return (
    <div className="fa-fp-section">
      <div className="fa-fp-label">Patient</div>
      {value && selected ? (
        <div className="fa-fp-selected">
          <span>{selected.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Retirer le patient">
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Nom ou téléphone…"
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
