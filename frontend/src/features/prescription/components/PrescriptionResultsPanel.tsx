/**
 * PrescriptionResultsPanel — surface unifiée pour les résultats d'une
 * ordonnance LAB / IMAGING.
 *
 *  v1 (V015) : upload du PDF/photo scanné du laboratoire ou du radiologue.
 *  v2 (V045) : champ texte libre en parallèle (déprécié pour la saisie —
 *              gardé en lecture uniquement, plus de capture côté UI).
 *  v3 (V047) : saisie STRUCTURÉE analyte/valeur/unité. Cette structure
 *              alimente le graphe d'évolution biologique du dossier
 *              patient (suivi de Hb / Plaquettes / Glycémie etc. dans le
 *              temps quand l'analyse est re-prescrite). Remplace en
 *              pratique le champ texte de V045 pour le travail clinique.
 *
 * Ne se monte que si {@code prescription.type ∈ {LAB, IMAGING}} (DRUG n'a
 * pas de résultat — l'API renverrait 400 RESULT_NOT_APPLICABLE).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Trash } from '@/components/icons';
import { PrescriptionLineResultButton } from './PrescriptionLineResultButton';
import {
  useResultValues,
  useSaveResultValues,
  type ResultValueInput,
} from '../hooks/useResultValues';
import type { PrescriptionApi } from '../types';

interface Props {
  prescription: PrescriptionApi;
  readOnly?: boolean;
}

interface DraftRow {
  analyte: string;
  value: string; // texte tampon — converti en number à l'enregistrement
  unit: string;
}

const EMPTY_ROW: DraftRow = { analyte: '', value: '', unit: '' };

export function PrescriptionResultsPanel({ prescription, readOnly = false }: Props) {
  const isResultable = prescription.type === 'LAB' || prescription.type === 'IMAGING';
  const lines = prescription.lines;

  // Anchor : même stratégie que pour le PDF (première ligne avec un résultat,
  // sinon la première ligne).
  const anchor =
    lines.find((l) => l.resultDocumentId || l.resultText) ?? lines[0];

  const { values: persisted } = useResultValues(anchor?.id);
  const { save, isPending } = useSaveResultValues();

  const [rows, setRows] = useState<DraftRow[]>([{ ...EMPTY_ROW }]);

  // Hydrate les rows depuis le serveur quand l'anchor / les valeurs changent.
  useEffect(() => {
    if (persisted.length > 0) {
      setRows(
        persisted.map((v) => ({
          analyte: v.analyte,
          value: String(v.value),
          unit: v.unit ?? '',
        })),
      );
    } else {
      setRows([{ ...EMPTY_ROW }]);
    }
  }, [persisted]);

  if (!isResultable) return null;
  if (!anchor) return null;

  function updateRow(idx: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(idx: number) {
    setRows((prev) =>
      prev.length === 1 ? [{ ...EMPTY_ROW }] : prev.filter((_, i) => i !== idx),
    );
  }

  async function onSave() {
    if (!anchor) return;
    // Filtre les lignes vides puis valide.
    const cleaned: ResultValueInput[] = [];
    for (const r of rows) {
      const analyte = r.analyte.trim();
      const rawValue = r.value.trim().replace(',', '.');
      if (!analyte && !rawValue) continue;
      if (!analyte) {
        toast.error("L'analyte est requis pour chaque ligne.");
        return;
      }
      if (!rawValue) {
        toast.error(`La valeur est requise pour « ${analyte} ».`);
        return;
      }
      const n = Number(rawValue);
      if (!Number.isFinite(n)) {
        toast.error(`Valeur invalide pour « ${analyte} » : ${rawValue}.`);
        return;
      }
      cleaned.push({ analyte, value: n, unit: r.unit.trim() || null });
    }
    try {
      await save(anchor.id, cleaned);
      toast.success(
        cleaned.length === 0
          ? 'Résultats effacés.'
          : `${cleaned.length} valeur${cleaned.length > 1 ? 's' : ''} enregistrée${
              cleaned.length > 1 ? 's' : ''
            }.`,
      );
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 400) {
        toast.error('Données invalides — vérifiez les champs.');
      } else {
        toast.error("Échec de l'enregistrement.");
      }
    }
  }

  // Le bouton Enregistrer est désactivé si rien n'a changé par rapport au serveur.
  const dirty = (() => {
    if (rows.length !== Math.max(persisted.length, 1)) return true;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const p = persisted[i];
      const analyte = r.analyte.trim();
      const value = r.value.trim().replace(',', '.');
      const unit = r.unit.trim();
      if (!p) {
        if (analyte || value || unit) return true;
        continue;
      }
      if (analyte !== p.analyte) return true;
      if (value !== String(p.value)) return true;
      if (unit !== (p.unit ?? '')) return true;
    }
    return false;
  })();

  return (
    <div
      data-testid="prescription-results-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '10px 12px',
        background: 'var(--surface-2, rgba(0,0,0,0.02))',
        borderRadius: 8,
        marginTop: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrescriptionLineResultButton
          lineId={anchor.id}
          resultDocumentId={anchor.resultDocumentId}
          disabled={readOnly}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
          Résultats — saisie structurée (utilisée pour le suivi d'évolution)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr auto',
            gap: 8,
            fontSize: 11,
            color: 'var(--ink-3)',
            padding: '0 4px',
          }}
        >
          <div>Analyte</div>
          <div>Valeur</div>
          <div>Unité</div>
          <div></div>
        </div>
        {rows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              data-testid={`result-row-analyte-${idx}`}
              type="text"
              list={`analyte-suggestions-${anchor.id}`}
              value={row.analyte}
              onChange={(e) => updateRow(idx, { analyte: e.target.value })}
              disabled={readOnly || isPending}
              placeholder="Hb"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            />
            <input
              data-testid={`result-row-value-${idx}`}
              type="text"
              inputMode="decimal"
              value={row.value}
              onChange={(e) => updateRow(idx, { value: e.target.value })}
              disabled={readOnly || isPending}
              placeholder="14.2"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            />
            <input
              data-testid={`result-row-unit-${idx}`}
              type="text"
              value={row.unit}
              onChange={(e) => updateRow(idx, { unit: e.target.value })}
              disabled={readOnly || isPending}
              placeholder="g/dL"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Supprimer la ligne ${idx + 1}`}
              disabled={readOnly || isPending}
              onClick={() => removeRow(idx)}
            >
              <Trash />
            </Button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={readOnly || isPending}
            onClick={addRow}
          >
            + Ajouter une ligne
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={readOnly || isPending || !dirty}
            onClick={() => void onSave()}
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
