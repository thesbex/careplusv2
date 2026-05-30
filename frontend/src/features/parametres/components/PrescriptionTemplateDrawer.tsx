/**
 * Drawer dédié à la création / édition d'un modèle de prescription
 * (`PrescriptionTemplate`). Réutilise `useCatalogSearch` du module prescription
 * pour l'autocomplete catalogue. Pas d'allergy override (les allergies
 * dépendent d'un patient, pas du modèle).
 */
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close, Pill as PillIcon, Search, Trash } from '@/components/icons';
import { useCatalogSearch } from '@/features/prescription/hooks/useCatalogSearch';
import { useT } from '@/lib/i18n/I18nProvider';
import type { CatalogItem, PrescriptionType } from '@/features/prescription/types';
import {
  useCreatePrescriptionTemplate,
  useUpdatePrescriptionTemplate,
  type DrugTemplateLine,
  type ImagingTemplateLine,
  type LabTemplateLine,
  type PrescriptionTemplate,
  type TemplateLine,
  type TemplateType,
} from '../hooks/usePrescriptionTemplates';
import '@/features/prescription/prescription.css';

/** État local d'une ligne — on garde un objet matérialisé (item: CatalogItem)
 *  pour afficher le nom dans l'UI, plus les champs spécifiques au type. */
interface LineDraft {
  item: CatalogItem | null;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string; // input texte, on parse au moment du submit
  instructions: string;
}

function emptyLine(): LineDraft {
  return { item: null, dosage: '', frequency: '', duration: '', quantity: '', instructions: '' };
}

interface PrescriptionTemplateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TemplateType;
  /** Si défini, le drawer est en mode édition. Sinon création. */
  template?: PrescriptionTemplate | null;
}

/** type → suffixe utilisé pour composer les clés i18n DRUG/LAB/IMAGING. */
const TYPE_KEY: Record<TemplateType, string> = {
  DRUG: 'Drug',
  LAB: 'Lab',
  IMAGING: 'Imaging',
};

export function PrescriptionTemplateDrawer({
  open,
  onOpenChange,
  type,
  template,
}: PrescriptionTemplateDrawerProps) {
  const { t } = useT();
  const suffix = TYPE_KEY[type];
  const [name, setName] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  // Le useCatalogSearch attend un PrescriptionType (DRUG/LAB/IMAGING/CERT/...).
  // TemplateType est strictement un sous-ensemble — cast direct est sûr.
  const { results, isFetching, hasQuery } = useCatalogSearch(type as PrescriptionType, query);

  const { create, isPending: creating } = useCreatePrescriptionTemplate();
  const { update, isPending: updating } = useUpdatePrescriptionTemplate();
  const isPending = creating || updating;

  // Hydrate à l'ouverture (création = vide, édition = depuis template).
  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setLines(template.lines.map((l) => materialize(l, template.type)));
    } else {
      setName('');
      setLines([emptyLine()]);
    }
    setQuery('');
    setSuggestOpen(false);
  }, [open, template]);

  // Click outside pour fermer la suggestion list.
  useEffect(() => {
    if (!suggestOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [suggestOpen]);

  function selectItem(item: CatalogItem) {
    setLines((ls) => {
      const last = ls[ls.length - 1];
      if (last && !last.item) {
        const next = [...ls];
        next[ls.length - 1] = { ...last, item };
        return next;
      }
      return [...ls, { ...emptyLine(), item }];
    });
    setQuery('');
    setSuggestOpen(false);
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((_, idx) => idx !== i)));
  }

  async function handleSave() {
    if (name.trim().length === 0) {
      toast.error(t('settings.tpl.needName'));
      return;
    }
    const filled = lines.filter((l) => l.item !== null);
    if (filled.length === 0) {
      toast.error(t(`settings.tpl.needLine${suffix}`));
      return;
    }

    const payloadLines = filled.map((l) => serialize(l, type));

    try {
      if (template) {
        await update(template.id, { name: name.trim(), type, lines: payloadLines });
        toast.success(t('settings.tpl.updated'));
      } else {
        await create({ name: name.trim(), type, lines: payloadLines });
        toast.success(t('settings.tpl.created'));
      }
      onOpenChange(false);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      if (e.response?.status === 409) {
        toast.error(t('settings.tpl.dupName'));
      } else if (e.response?.status === 403) {
        toast.error(t('settings.tpl.permDenied'));
      } else {
        toast.error(e.response?.data?.detail ?? t('settings.tpl.saveErr'));
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pr-overlay" />
        <Dialog.Content className="pr-drawer" aria-label={t('settings.tpl.dialogAria')}>
          <div className="pr-header">
            <PillIcon />
            <div style={{ flex: 1 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {template ? t('settings.tpl.editTitle') : t('settings.tpl.newTitle')}
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>
                {t(`settings.tpl.desc${suffix}`)}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <div className="pr-body scroll">
            <div className="pr-section-h">{t('settings.tpl.nameLabel')}</div>
            <input
              type="text"
              className="pr-search-input"
              placeholder={t('settings.tpl.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 13,
                background: 'var(--surface)',
              }}
              aria-label={t('settings.tpl.nameLabel')}
            />

            <div className="pr-section-h" style={{ marginTop: 16 }}>
              {t(`settings.tpl.search${suffix}`)}
            </div>
            <div className="pr-search" ref={searchWrapRef}>
              <span className="pr-search-icon">
                <Search aria-hidden="true" />
              </span>
              <input
                className="pr-search-input"
                placeholder={t(`settings.tpl.ph${suffix}`)}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSuggestOpen(false);
                }}
                aria-label={t('settings.tpl.searchAria')}
              />
              {suggestOpen && hasQuery && (
                <div className="pr-suggest" role="listbox">
                  {isFetching && (
                    <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>{t('settings.tpl.searching')}</div>
                  )}
                  {!isFetching && results.length === 0 && (
                    <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>{t('settings.tpl.noResult')}</div>
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

            <div className="pr-section-h" style={{ marginTop: 16 }}>
              {t('settings.tpl.linesCount', { n: lines.filter((l) => l.item).length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((l, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 10,
                    background: l.item ? 'var(--surface)' : 'var(--bg-alt)',
                  }}
                >
                  {l.item ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <strong style={{ fontSize: 13 }}>{l.item.name}</strong>
                        {l.item.sub && (
                          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l.item.sub}</span>
                        )}
                        <button
                          type="button"
                          aria-label={t('settings.tpl.removeLineAria')}
                          onClick={() => removeLine(i)}
                          style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--danger)',
                            padding: 2,
                            lineHeight: 0,
                          }}
                        >
                          <Trash />
                        </button>
                      </div>
                      {type === 'DRUG' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          <Input value={l.dosage} placeholder={t('settings.tpl.dosage')} onChange={(v) => updateLine(i, { dosage: v })} />
                          <Input value={l.frequency} placeholder={t('settings.tpl.frequency')} onChange={(v) => updateLine(i, { frequency: v })} />
                          <Input value={l.duration} placeholder={t('settings.tpl.duration')} onChange={(v) => updateLine(i, { duration: v })} />
                          <Input value={l.quantity} placeholder={t('settings.tpl.qty')} onChange={(v) => updateLine(i, { quantity: v })} />
                          <textarea
                            value={l.instructions}
                            placeholder={t('settings.tpl.instructions')}
                            onChange={(e) => updateLine(i, { instructions: e.target.value })}
                            rows={2}
                            style={{
                              gridColumn: '1 / -1',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: 6,
                              fontFamily: 'inherit',
                              fontSize: 12,
                              resize: 'vertical',
                            }}
                          />
                        </div>
                      ) : (
                        <textarea
                          value={l.instructions}
                          placeholder={t('settings.tpl.instructionsOpt')}
                          onChange={(e) => updateLine(i, { instructions: e.target.value })}
                          rows={2}
                          style={{
                            width: '100%',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: 6,
                            fontFamily: 'inherit',
                            fontSize: 12,
                            resize: 'vertical',
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>
                      {t(`settings.tpl.addHint${suffix}`)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <Button type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => { void handleSave(); }}
              disabled={isPending}
            >
              {template ? t('common.save') : t('settings.tpl.createBtn')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Input({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        height: 30,
        padding: '0 8px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontFamily: 'inherit',
        fontSize: 12,
        background: 'var(--surface)',
      }}
    />
  );
}

function materialize(line: TemplateLine, type: TemplateType): LineDraft {
  if (type === 'DRUG') {
    const d = line as DrugTemplateLine;
    return {
      item: { id: d.medicationId, name: d.medicationCode, sub: null },
      dosage: d.dosage ?? '',
      frequency: d.frequency ?? '',
      duration: d.duration ?? '',
      quantity: d.quantity != null ? String(d.quantity) : '',
      instructions: d.instructions ?? '',
    };
  }
  if (type === 'LAB') {
    const l = line as LabTemplateLine;
    return {
      item: { id: l.labTestId, name: l.labTestCode, sub: null },
      dosage: '', frequency: '', duration: '', quantity: '',
      instructions: l.instructions ?? '',
    };
  }
  const im = line as ImagingTemplateLine;
  return {
    item: { id: im.imagingExamId, name: im.imagingExamCode, sub: null },
    dosage: '', frequency: '', duration: '', quantity: '',
    instructions: im.instructions ?? '',
  };
}

function serialize(l: LineDraft, type: TemplateType): TemplateLine {
  if (!l.item) throw new Error('serialize called with empty item');
  if (type === 'DRUG') {
    const out: DrugTemplateLine = {
      medicationId: l.item.id,
      medicationCode: l.item.name,
    };
    if (l.dosage.trim()) out.dosage = l.dosage.trim();
    if (l.frequency.trim()) out.frequency = l.frequency.trim();
    if (l.duration.trim()) out.duration = l.duration.trim();
    if (l.quantity.trim()) {
      const n = Number(l.quantity.trim());
      if (Number.isFinite(n)) out.quantity = n;
    }
    if (l.instructions.trim()) out.instructions = l.instructions.trim();
    return out;
  }
  if (type === 'LAB') {
    const out: LabTemplateLine = { labTestId: l.item.id, labTestCode: l.item.name };
    if (l.instructions.trim()) out.instructions = l.instructions.trim();
    return out;
  }
  const out: ImagingTemplateLine = { imagingExamId: l.item.id, imagingExamCode: l.item.name };
  if (l.instructions.trim()) out.instructions = l.instructions.trim();
  return out;
}
