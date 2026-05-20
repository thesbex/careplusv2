/**
 * PrescriptionResultsPanel — surface unifiée pour les résultats d'une
 * ordonnance LAB / IMAGING.
 *
 * v1 (V015) : upload du PDF/photo du laboratoire ou du radiologue. UN seul
 * bouton anchor-é sur la ligne qui porte déjà un résultat, sinon la première.
 *
 * v2 (V045) : champ texte libre en parallèle du PDF — le médecin tape les
 * valeurs lues sur le rapport pour pouvoir comparer numériquement d'une
 * consultation à l'autre sans rouvrir le PDF.
 *
 * Ne se monte que si {@code prescription.type ∈ {LAB, IMAGING}} (DRUG n'a
 * pas de résultat — l'API renverrait 400 RESULT_NOT_APPLICABLE).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { PrescriptionLineResultButton } from './PrescriptionLineResultButton';
import { useSavePrescriptionResultText } from '../hooks/usePrescriptionResult';
import type { PrescriptionApi } from '../types';

interface Props {
  prescription: PrescriptionApi;
  /** Désactive l'upload + la saisie texte (consultation signée, droit absent…). */
  readOnly?: boolean;
}

const TEXT_MAX = 8000;

export function PrescriptionResultsPanel({ prescription, readOnly = false }: Props) {
  const isResultable = prescription.type === 'LAB' || prescription.type === 'IMAGING';
  const lines = prescription.lines;

  // Anchor sur la première ligne qui porte déjà un résultat (PDF ou texte),
  // sinon la première ligne tout court. Même stratégie que pour le PDF, étendue
  // à `resultText` pour que la valeur saisie reste visible si l'utilisateur
  // réordonne les lignes.
  const anchor =
    lines.find((l) => l.resultDocumentId || l.resultText) ?? lines[0];

  const { saveText, isPending } = useSavePrescriptionResultText();

  // État local — initialisé depuis le serveur, dirty-flag pour activer le
  // bouton « Enregistrer » uniquement quand il y a vraiment quelque chose à
  // sauvegarder. Re-sync si l'anchor change (édition d'une autre prescription
  // dans le drawer, par exemple).
  const initial = anchor?.resultText ?? '';
  const [text, setText] = useState<string>(initial);
  useEffect(() => {
    setText(initial);
  }, [initial]);

  if (!isResultable) return null;
  if (!anchor) return null;

  const dirty = text !== initial;

  async function onSave() {
    if (!anchor) return;
    try {
      const trimmed = text.trim();
      await saveText({ lineId: anchor.id, text: trimmed.length > 0 ? trimmed : null });
      toast.success(trimmed ? 'Résultat enregistré.' : 'Résultat effacé.');
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 400) {
        toast.error('Saisie invalide', {
          description: `Maximum ${TEXT_MAX.toLocaleString('fr-FR')} caractères.`,
        });
      } else {
        toast.error("Échec de l'enregistrement.");
      }
    }
  }

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
        <label
          htmlFor={`prescription-result-text-${anchor.id}`}
          style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}
        >
          Résultats saisis (texte)
        </label>
        <textarea
          id={`prescription-result-text-${anchor.id}`}
          data-testid="prescription-result-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={readOnly || isPending}
          rows={4}
          maxLength={TEXT_MAX}
          placeholder="Ex. NFS : H 14.2 / L 4.8 / Pq 245k — Glycémie : 1.02 g/L — Créat : 8.9 mg/L"
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.4,
            resize: 'vertical',
            background: 'var(--surface)',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--ink-3)',
          }}
        >
          <span>{text.length} / {TEXT_MAX} caractères</span>
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
