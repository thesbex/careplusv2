/**
 * Prescription drawer — screen 07.
 * Radix Dialog-based drawer anchored right. Medication autocomplete against
 * /api/catalog/medications, dynamic line editor, allergy override flow on 422.
 */
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close, Pill as PillIcon, Plus, Search, Trash, Warn, Check } from '@/components/icons';
import { useCatalogSearch } from './hooks/useCatalogSearch';
import {
  useCreatePrescription,
  AllergyConflictError,
} from './hooks/useCreatePrescription';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';
import { PrescriptionTemplatePicker } from './components/PrescriptionTemplatePicker';
import { PdfGenerationOverlay } from './components/PdfGenerationOverlay';
import type {
  CatalogItem,
  PrescriptionLineDraft,
  PrescriptionType,
} from './types';
import type {
  PrescriptionTemplate,
  TemplateType,
  DrugTemplateLine,
  LabTemplateLine,
  ImagingTemplateLine,
} from '@/features/parametres/hooks/usePrescriptionTemplates';
import './prescription.css';

interface PrescriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  patientAllergies: string[];
  type?: PrescriptionType;
  onCreated?: (prescriptionId: string) => void;
}

function emptyLine(): PrescriptionLineDraft {
  return {
    item: null,
    dosage: '',
    frequency: '',
    duration: '',
    quantity: null,
    instructions: '',
  };
}

export function PrescriptionDrawer({
  open,
  onOpenChange,
  consultationId,
  patientAllergies,
  type = 'DRUG',
  onCreated,
}: PrescriptionDrawerProps) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [lines, setLines] = useState<PrescriptionLineDraft[]>([emptyLine()]);
  const [recommendations, setRecommendations] = useState('');
  const [conflict, setConflict] = useState<{ medication: string; allergy: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  // V038 — toggle "Réaliser en interne" pour LAB/IMAGING.
  const [internalRouting, setInternalRouting] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const { results, isFetching, hasQuery } = useCatalogSearch(type, query);
  const { settings } = useClinicSettings();
  const internalToggleVisible =
    (type === 'LAB' && !!settings?.labInternal)
    || (type === 'IMAGING' && !!settings?.imagingInternal)
    // V057 (QA9-7) — pharmacie interne : fournir les médicaments en interne (facturé à la signature).
    || (type === 'DRUG' && !!settings?.pharmacyInternal);

  // Médicaments fournis en interne mais SANS prix au catalogue : la facturation
  // les ignore silencieusement. On avertit le prescripteur. `internalPrice`
  // undefined (ligne issue d'un modèle, prix non chargé) → pas d'avertissement.
  const internalDrugsWithoutPrice =
    type === 'DRUG' && internalRouting
      ? lines.filter(
          (l) => l.item && (l.item.internalPrice === null || l.item.internalPrice === 0),
        )
      : [];

  useEffect(() => {
    if (!suggestOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [suggestOpen]);
  const { createPrescription, isPending } = useCreatePrescription();

  function selectItem(item: CatalogItem) {
    setLines((ls) => {
      const lastIdx = ls.length - 1;
      const last = ls[lastIdx];
      if (last && !last.item) {
        const next = [...ls];
        next[lastIdx] = { ...last, item };
        return next;
      }
      return [...ls, { ...emptyLine(), item }];
    });
    setQuery('');
    setSuggestOpen(false);
  }

  function updateLine(i: number, patch: Partial<PrescriptionLineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((_, idx) => idx !== i)));
  }

  /** QA6-2 + QA6-3 — append des lignes du template au drawer. Si le drawer
   *  est dans son état initial (1 ligne vide), on remplace pour ne pas
   *  garder la ligne vide en haut. */
  function handleTemplateLoad(template: PrescriptionTemplate) {
    setLines((prev) => {
      const trimmed =
        prev.length === 1 && prev[0] && !prev[0].item && !prev[0].instructions.trim()
          ? []
          : prev;
      const materialized = template.lines.map((l) => materializeTemplateLine(l, template.type));
      return [...trimmed, ...materialized];
    });
  }

  async function handleSave(allergyOverride = false) {
    const filled = lines.filter((l) => l.item !== null || l.instructions.trim().length > 0);
    if (filled.length === 0) {
      toast.error(
        t(
          type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
            ? `presc.err.needLine.${type}`
            : 'presc.err.needLine.default',
        ),
      );
      return;
    }
    const instructionsWithReco = recommendations
      ? filled.map((l, i) =>
          i === 0 ? { ...l, instructions: `${l.instructions ?? ''}\n${recommendations}`.trim() } : l,
        )
      : filled;
    try {
      const payload: Parameters<typeof createPrescription>[0] = {
        consultationId,
        type,
        lines: instructionsWithReco,
        allergyOverride,
      };
      if (allergyOverride) payload.allergyOverrideReason = overrideReason;
      if (internalToggleVisible && internalRouting) payload.internal = true;
      const created = await createPrescription(payload);
      toast.success(t('presc.ok.created'));
      onCreated?.(created.id);
      onOpenChange(false);
      resetState();
    } catch (err) {
      if (err instanceof AllergyConflictError) {
        setConflict({ medication: err.medication, allergy: err.allergy });
        toast.error(t('presc.err.conflictToast', { medication: err.medication, allergy: err.allergy }), {
          description: t('presc.err.conflictDesc'),
        });
      } else {
        // Retour terrain Excel : "Request failed with status code 400" était
        // affiché tel quel — pas actionable. On extrait le `detail` du
        // ProblemDetail (RFC 7807) renvoyé par le BE pour montrer la vraie
        // raison (ex. "Consultation signée — impossible d'ajouter une
        // prescription").
        let description: string | undefined;
        const ax = err as { response?: { data?: { detail?: string; title?: string } }; message?: string };
        if (ax.response?.data?.detail) {
          description = ax.response.data.detail;
        } else if (ax.response?.data?.title) {
          description = ax.response.data.title;
        } else if (err instanceof Error) {
          description = err.message;
        }
        toast.error(t('presc.err.createFailed'), { description });
      }
    }
  }

  function resetState() {
    setQuery('');
    setSuggestOpen(false);
    setLines([emptyLine()]);
    setRecommendations('');
    setConflict(null);
    setOverrideReason('');
    setInternalRouting(false);
  }

  return (
    <>
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pr-overlay" />
        <Dialog.Content className="pr-drawer" aria-label={t('presc.drawer.aria')}>
          <div className="pr-header">
            <PillIcon />
            <div style={{ flex: 1 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {t(
                  type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                    ? `presc.title.${type}`
                    : 'presc.title.default',
                )}
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>
                {t(
                  type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                    ? `presc.sub.${type}`
                    : 'presc.sub.default',
                )}
              </Dialog.Description>
            </div>
            {(type === 'DRUG' || type === 'LAB' || type === 'IMAGING') && (
              <PrescriptionTemplatePicker
                type={type as TemplateType}
                onLoad={handleTemplateLoad}
              />
            )}
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('presc.drawer.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          {patientAllergies.length > 0 && (
            <div
              className={`pr-allergy-banner${conflict ? ' conflict' : ''}`}
              role="alert"
            >
              <Warn />
              {conflict
                ? t('presc.allergy.conflict', {
                    medication: conflict.medication,
                    allergy: conflict.allergy,
                  })
                : t(
                    patientAllergies.length > 1 ? 'presc.allergy.known.many' : 'presc.allergy.known.one',
                    { list: patientAllergies.join(', ') },
                  )}
            </div>
          )}

          <div className="pr-body scroll">
            {(type === 'DRUG' || type === 'LAB' || type === 'IMAGING') && (
              <>
                <div className="pr-section-h">
                  {t(`presc.search.${type}`)}
                </div>
                <div className="pr-search" ref={searchWrapRef}>
                  <span className="pr-search-icon">
                    <Search aria-hidden="true" />
                  </span>
                  <input
                    className="pr-search-input"
                    placeholder={t(`presc.search.ph.${type}`)}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSuggestOpen(true);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSuggestOpen(false);
                    }}
                    aria-label={t('presc.search.aria')}
                  />
                  {suggestOpen && hasQuery && (
                    <div className="pr-suggest" role="listbox">
                      {isFetching && (
                        <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                          {t('presc.search.searching')}
                        </div>
                      )}
                      {!isFetching && results.length === 0 && (
                        <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                          {t('presc.search.noResult')}
                        </div>
                      )}
                      {results.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="pr-suggest-row"
                          onClick={() => selectItem(it)}
                        >
                          <span className="pr-suggest-name">{it.name}</span>
                          {it.sub && <span className="pr-suggest-sub">{it.sub}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* V038 — toggle "Réaliser en interne" (LAB/IMAGING quand flag actif) */}
            {internalToggleVisible && (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '10px 12px',
                  background: internalRouting ? 'var(--primary-soft)' : 'var(--bg-2, #fafafa)',
                  margin: '12px 0',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={internalRouting}
                    onChange={(e) => setInternalRouting(e.target.checked)}
                    aria-label={t(type === 'DRUG' ? 'presc.internal.aria.DRUG' : 'presc.internal.aria.other')}
                  />
                  <strong>{t(type === 'DRUG' ? 'presc.internal.label.DRUG' : 'presc.internal.label.other')}</strong>
                </label>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.4 }}>
                  {t(
                    type === 'DRUG'
                      ? 'presc.internal.hint.DRUG'
                      : type === 'LAB'
                      ? 'presc.internal.hint.LAB'
                      : 'presc.internal.hint.IMAGING',
                  )}
                </div>
              </div>
            )}

            {/* V057 — avertissement : médicament « fourni en interne » sans prix au
                catalogue ne sera pas ajouté à la facture (skip silencieux côté billing). */}
            {internalDrugsWithoutPrice.length > 0 && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  border: '1px solid var(--amber, #e0a23a)',
                  background: 'var(--amber-soft, #fff4e0)',
                  borderRadius: 'var(--r-md)',
                  padding: '10px 12px',
                  margin: '0 0 12px',
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: 'var(--ink-2)',
                }}
              >
                <span style={{ color: 'var(--amber, #e0a23a)', flexShrink: 0, marginTop: 1 }}>
                  <Warn aria-hidden="true" />
                </span>
                <span>
                  {t(
                    internalDrugsWithoutPrice.length > 1 ? 'presc.noPrice.many' : 'presc.noPrice.one',
                    { names: internalDrugsWithoutPrice.map((l) => l.item?.name).join(', ') },
                  )}
                </span>
              </div>
            )}
            <div className="pr-section-h">
              {t(
                type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                  ? `presc.lines.${type}`
                  : 'presc.lines.default',
                { n: lines.filter((l) => l.item).length },
              )}
            </div>
            {lines.map((line, i) => (
              <div key={i} className="pr-line-card">
                <div className="pr-line-head">
                  <div style={{ flex: 1 }}>
                    <div className="pr-line-name">
                      {line.item?.name ??
                        t(
                          type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                            ? `presc.line.pick.${type}`
                            : 'presc.line.pick.default',
                        )}
                    </div>
                    {line.item?.sub && (
                      <div className="pr-line-meta">
                        {line.item.sub}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={t('presc.line.removeAria')}
                    onClick={() => removeLine(i)}
                  >
                    <Trash />
                  </Button>
                </div>
                {type === 'DRUG' && (
                  <div className="pr-line-grid">
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-dos-${i}`}>{t('presc.field.dosage')}</label>
                      <input
                        id={`pr-dos-${i}`}
                        value={line.dosage}
                        onChange={(e) => updateLine(i, { dosage: e.target.value })}
                        placeholder={t('presc.field.dosage.ph')}
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-freq-${i}`}>{t('presc.field.frequency')}</label>
                      <input
                        id={`pr-freq-${i}`}
                        value={line.frequency}
                        onChange={(e) => updateLine(i, { frequency: e.target.value })}
                        placeholder={t('presc.field.frequency.ph')}
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-dur-${i}`}>{t('presc.field.duration')}</label>
                      <input
                        id={`pr-dur-${i}`}
                        value={line.duration}
                        onChange={(e) => updateLine(i, { duration: e.target.value })}
                        placeholder={t('presc.field.duration.ph')}
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-qty-${i}`}>{t('presc.field.quantity')}</label>
                      <input
                        id={`pr-qty-${i}`}
                        type="number"
                        min={0}
                        value={line.quantity ?? ''}
                        onChange={(e) =>
                          updateLine(i, {
                            quantity: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        placeholder={t('presc.field.quantity.ph')}
                      />
                    </div>
                  </div>
                )}
                <div className="pr-field-sm" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor={`pr-notes-${i}`}>
                    {t(
                      type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                        ? `presc.notes.${type}`
                        : 'presc.notes.default',
                    )}
                  </label>
                  <input
                    id={`pr-notes-${i}`}
                    value={line.instructions}
                    onChange={(e) => updateLine(i, { instructions: e.target.value })}
                    placeholder={
                      type === 'DRUG' || type === 'LAB' || type === 'IMAGING'
                        ? t(`presc.notes.ph.${type}`)
                        : ''
                    }
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setLines((ls) => [...ls, emptyLine()])}
            >
              <Plus /> {t('presc.addLine')}
            </Button>

            <div className="pr-section-h">{t('presc.reco.title')}</div>
            <textarea
              style={{
                width: '100%',
                minHeight: 60,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 10,
                fontSize: 12.5,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder={t('presc.reco.ph')}
            />

            {conflict && (
              <>
                <div className="pr-section-h" style={{ color: 'var(--danger)' }}>
                  {t('presc.override.title')}
                </div>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: 60,
                    border: '1px solid var(--danger)',
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 12.5,
                    fontFamily: 'inherit',
                  }}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={t('presc.override.ph')}
                  aria-label={t('presc.override.aria')}
                />
              </>
            )}
          </div>

          <div className="pr-footer">
            <Dialog.Close asChild>
              <Button type="button">{t('presc.cancel')}</Button>
            </Dialog.Close>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {conflict ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPending || overrideReason.trim().length < 3}
                  onClick={() => {
                    void handleSave(true);
                  }}
                >
                  <Check /> {t('presc.override.confirm')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPending}
                  onClick={() => {
                    void handleSave(false);
                  }}
                >
                  <Check /> {isPending ? t('presc.saving') : t('presc.create')}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <PdfGenerationOverlay open={isPending} type={type} />
    </>
  );
}

/** Convertit une ligne de template (forme JSONB côté backend) en
 *  PrescriptionLineDraft pour le drawer. Le `medicationCode` (ou labTestCode /
 *  imagingExamCode) du template est utilisé comme `name` du CatalogItem
 *  matérialisé — le médecin reconnaîtra le médic via le code. Si l'item a
 *  été supprimé du catalogue depuis la création du template, la ligne est
 *  ajoutée quand même (pas de blocage). */
function materializeTemplateLine(
  line: DrugTemplateLine | LabTemplateLine | ImagingTemplateLine,
  type: TemplateType,
): PrescriptionLineDraft {
  if (type === 'DRUG') {
    const d = line as DrugTemplateLine;
    return {
      item: { id: d.medicationId, name: d.medicationCode, sub: null },
      dosage: d.dosage ?? '',
      frequency: d.frequency ?? '',
      duration: d.duration ?? '',
      quantity: d.quantity ?? null,
      instructions: d.instructions ?? '',
    };
  }
  if (type === 'LAB') {
    const l = line as LabTemplateLine;
    return {
      item: { id: l.labTestId, name: l.labTestCode, sub: null },
      dosage: '',
      frequency: '',
      duration: '',
      quantity: null,
      instructions: l.instructions ?? '',
    };
  }
  const im = line as ImagingTemplateLine;
  return {
    item: { id: im.imagingExamId, name: im.imagingExamCode, sub: null },
    dosage: '',
    frequency: '',
    duration: '',
    quantity: null,
    instructions: im.instructions ?? '',
  };
}
