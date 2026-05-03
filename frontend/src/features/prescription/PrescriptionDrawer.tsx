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
import { PrescriptionTemplatePicker } from './components/PrescriptionTemplatePicker';
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
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [lines, setLines] = useState<PrescriptionLineDraft[]>([emptyLine()]);
  const [recommendations, setRecommendations] = useState('');
  const [conflict, setConflict] = useState<{ medication: string; allergy: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const { results, isFetching, hasQuery } = useCatalogSearch(type, query);

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
        type === 'DRUG'
          ? 'Ajoutez au moins un médicament.'
          : type === 'LAB'
          ? 'Ajoutez au moins une analyse.'
          : type === 'IMAGING'
          ? 'Ajoutez au moins un examen.'
          : 'Ajoutez au moins une ligne.',
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
      const created = await createPrescription(payload);
      toast.success('Ordonnance créée.');
      onCreated?.(created.id);
      onOpenChange(false);
      resetState();
    } catch (err) {
      if (err instanceof AllergyConflictError) {
        setConflict({ medication: err.medication, allergy: err.allergy });
        toast.error(`Conflit : ${err.medication} / ${err.allergy}`, {
          description: 'Confirmez l\'override avec une raison pour continuer.',
        });
      } else {
        toast.error('Création impossible', {
          description: err instanceof Error ? err.message : undefined,
        });
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
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pr-overlay" />
        <Dialog.Content className="pr-drawer" aria-label="Nouvelle prescription">
          <div className="pr-header">
            <PillIcon />
            <div style={{ flex: 1 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {type === 'DRUG'
                  ? 'Prescription médicamenteuse'
                  : type === 'LAB'
                  ? "Bon d'analyses biologiques"
                  : type === 'IMAGING'
                  ? "Bon d'imagerie médicale"
                  : 'Ordonnance'}
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>
                {type === 'DRUG'
                  ? 'Médicaments'
                  : type === 'LAB'
                  ? 'Analyses biologiques'
                  : type === 'IMAGING'
                  ? 'Examens d\'imagerie'
                  : 'Ordonnance'}
              </Dialog.Description>
            </div>
            {(type === 'DRUG' || type === 'LAB' || type === 'IMAGING') && (
              <PrescriptionTemplatePicker
                type={type as TemplateType}
                onLoad={handleTemplateLoad}
              />
            )}
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
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
                ? `Conflit : ${conflict.medication} interagit avec l'allergie ${conflict.allergy}.`
                : `Allergie${patientAllergies.length > 1 ? 's' : ''} connue${
                    patientAllergies.length > 1 ? 's' : ''
                  } : ${patientAllergies.join(', ')}`}
            </div>
          )}

          <div className="pr-body scroll">
            {(type === 'DRUG' || type === 'LAB' || type === 'IMAGING') && (
              <>
                <div className="pr-section-h">
                  {type === 'DRUG'
                    ? 'Rechercher un médicament'
                    : type === 'LAB'
                    ? 'Rechercher une analyse'
                    : "Rechercher un examen d'imagerie"}
                </div>
                <div className="pr-search" ref={searchWrapRef}>
                  <span className="pr-search-icon">
                    <Search aria-hidden="true" />
                  </span>
                  <input
                    className="pr-search-input"
                    placeholder={
                      type === 'DRUG'
                        ? 'Nom commercial ou DCI…'
                        : type === 'LAB'
                        ? 'Nom de l\'analyse ou code…'
                        : "Nom de l'examen ou code…"
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSuggestOpen(true);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSuggestOpen(false);
                    }}
                    aria-label="Rechercher dans le catalogue"
                  />
                  {suggestOpen && hasQuery && (
                    <div className="pr-suggest" role="listbox">
                      {isFetching && (
                        <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                          Recherche…
                        </div>
                      )}
                      {!isFetching && results.length === 0 && (
                        <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                          Aucun résultat.
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

            <div className="pr-section-h">
              {type === 'DRUG'
                ? `Médicaments (${lines.filter((l) => l.item).length})`
                : type === 'LAB'
                ? `Analyses (${lines.filter((l) => l.item).length})`
                : type === 'IMAGING'
                ? `Examens (${lines.filter((l) => l.item).length})`
                : 'Lignes'}
            </div>
            {lines.map((line, i) => (
              <div key={i} className="pr-line-card">
                <div className="pr-line-head">
                  <div style={{ flex: 1 }}>
                    <div className="pr-line-name">
                      {line.item?.name ??
                        (type === 'DRUG'
                          ? 'Sélectionner un médicament…'
                          : type === 'LAB'
                          ? 'Sélectionner une analyse…'
                          : type === 'IMAGING'
                          ? 'Sélectionner un examen…'
                          : 'Ligne libre')}
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
                    aria-label="Supprimer la ligne"
                    onClick={() => removeLine(i)}
                  >
                    <Trash />
                  </Button>
                </div>
                {type === 'DRUG' && (
                  <div className="pr-line-grid">
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-dos-${i}`}>Posologie</label>
                      <input
                        id={`pr-dos-${i}`}
                        value={line.dosage}
                        onChange={(e) => updateLine(i, { dosage: e.target.value })}
                        placeholder="1 cp matin"
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-freq-${i}`}>Fréquence</label>
                      <input
                        id={`pr-freq-${i}`}
                        value={line.frequency}
                        onChange={(e) => updateLine(i, { frequency: e.target.value })}
                        placeholder="Par jour"
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-dur-${i}`}>Durée</label>
                      <input
                        id={`pr-dur-${i}`}
                        value={line.duration}
                        onChange={(e) => updateLine(i, { duration: e.target.value })}
                        placeholder="30 jours"
                      />
                    </div>
                    <div className="pr-field-sm">
                      <label htmlFor={`pr-qty-${i}`}>Quantité</label>
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
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
                <div className="pr-field-sm" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor={`pr-notes-${i}`}>
                    {type === 'DRUG'
                      ? 'Instructions (optionnel)'
                      : type === 'LAB'
                      ? 'Indication clinique / commentaire (optionnel)'
                      : type === 'IMAGING'
                      ? 'Renseignement clinique / région (optionnel)'
                      : 'Instructions (optionnel)'}
                  </label>
                  <input
                    id={`pr-notes-${i}`}
                    value={line.instructions}
                    onChange={(e) => updateLine(i, { instructions: e.target.value })}
                    placeholder={
                      type === 'DRUG'
                        ? 'Ex : à prendre avec un repas'
                        : type === 'LAB'
                        ? 'Ex : à jeun, suspicion diabète…'
                        : type === 'IMAGING'
                        ? 'Ex : douleur lombaire L4-L5…'
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
              <Plus /> Ajouter une ligne
            </Button>

            <div className="pr-section-h">Recommandations au patient</div>
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
              placeholder="Conseils, surveillance, consignes d'urgence…"
            />

            {conflict && (
              <>
                <div className="pr-section-h" style={{ color: 'var(--danger)' }}>
                  Override allergie requis
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
                  placeholder="Justification clinique de l'override…"
                  aria-label="Raison de l'override allergie"
                />
              </>
            )}
          </div>

          <div className="pr-footer">
            <Dialog.Close asChild>
              <Button type="button">Annuler</Button>
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
                  <Check /> Confirmer override
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
                  <Check /> {isPending ? 'Enregistrement…' : 'Créer l\'ordonnance'}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
