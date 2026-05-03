/**
 * ConsultationPrestationsPanel — bloc « Prestations réalisées » dans
 * l'écran Consultation (V016).
 *
 * - Liste les prestations déjà ajoutées (label, prix unitaire, qty,
 *   ligne total) avec bouton ⌫ pour retirer.
 * - Combobox de catalogue + qty + bouton « Ajouter » pour en attacher
 *   une nouvelle. Le prix s'auto-snape au defaultPrice de la prestation
 *   choisie ; le médecin peut surcharger.
 * - Total prestations affiché en bas — utile pour la facturation
 *   (le module billing peut intégrer ce total au montant facture).
 *
 * Désactivé si la consultation est SIGNEE (readOnly) ou en cas de
 * 409 CONSULT_LOCKED renvoyé par l'API.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Trash } from '@/components/icons';
import {
  useAddPrestation,
  useConsultationPrestations,
  usePrestationCatalog,
  useRemovePrestation,
} from '../hooks/usePrestations';

interface Props {
  consultationId: string;
  /** True si la consultation est signée — désactive les CTAs. */
  readOnly?: boolean;
}

export function ConsultationPrestationsPanel({ consultationId, readOnly = false }: Props) {
  const { items, isLoading } = useConsultationPrestations(consultationId);
  const { prestations: catalog } = usePrestationCatalog(false);
  const { add, isPending: adding } = useAddPrestation(consultationId);
  const { remove } = useRemovePrestation(consultationId);

  const [pickedId, setPickedId] = useState('');
  const [qty, setQty] = useState(1);
  const [unitPriceOverride, setUnitPriceOverride] = useState<string>('');

  const picked = useMemo(
    () => catalog.find((p) => p.id === pickedId) ?? null,
    [catalog, pickedId],
  );

  // Auto-fill du prix avec le defaultPrice quand on choisit une prestation
  // (sauf si l'utilisateur a déjà tapé un prix — qu'on ne veut pas écraser).
  function onPick(id: string) {
    setPickedId(id);
    if (!unitPriceOverride) {
      const next = catalog.find((p) => p.id === id);
      if (next) setUnitPriceOverride(String(next.defaultPrice));
    }
  }

  async function onAdd() {
    if (!picked) return;
    try {
      const priceNum = unitPriceOverride !== '' ? Number(unitPriceOverride) : null;
      await add({
        prestationId: picked.id,
        unitPrice: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
        quantity: qty,
      });
      setPickedId('');
      setUnitPriceOverride('');
      setQty(1);
      toast.success(`${picked.label} ajoutée.`);
    } catch (err) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 409) toast.error('Consultation signée : modification impossible.');
      else if (status === 400) toast.error('Prestation invalide ou désactivée.');
      else toast.error('Échec de l\'ajout.');
    }
  }

  async function onRemove(linkId: string, label: string) {
    try {
      await remove(linkId);
      toast.success(`${label} retirée.`);
    } catch {
      toast.error('Échec de la suppression.');
    }
  }

  const total = items.reduce((sum, l) => sum + (l.lineTotal ?? l.unitPrice * l.quantity), 0);

  return (
    <div data-testid="consultation-prestations-panel" className="cs-prestations">
      <div className="cs-section-h" style={{ marginTop: 18 }}>
        Prestations réalisées
      </div>

      {!readOnly && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            padding: '8px 12px',
            background: 'var(--surface-2, rgba(0,0,0,0.02))',
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 2, minWidth: 220 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Prestation</span>
            <select
              value={pickedId}
              onChange={(e) => onPick(e.target.value)}
              aria-label="Choisir une prestation"
              style={{ padding: '6px 8px' }}
            >
              <option value="">— choisir —</option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.defaultPrice} MAD)
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 90 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Qté</span>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Quantité"
              style={{ padding: '6px 8px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 120 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Prix unitaire (MAD)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unitPriceOverride}
              placeholder={picked ? String(picked.defaultPrice) : ''}
              onChange={(e) => setUnitPriceOverride(e.target.value)}
              aria-label="Prix unitaire"
              style={{ padding: '6px 8px' }}
            />
          </label>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!picked || adding}
            onClick={onAdd}
          >
            Ajouter
          </Button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 8, color: 'var(--ink-3)' }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 8, color: 'var(--ink-3)', fontSize: 13 }}>
          Aucune prestation pour le moment.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto auto',
                gap: 12,
                alignItems: 'center',
                padding: '6px 12px',
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border, rgba(0,0,0,0.08))',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <span>{item.prestationLabel}</span>
              <span style={{ color: 'var(--ink-3)' }}>{item.unitPrice} MAD</span>
              <span style={{ color: 'var(--ink-3)' }}>× {item.quantity}</span>
              <strong>{(item.lineTotal ?? item.unitPrice * item.quantity).toFixed(2)} MAD</strong>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(item.id, item.prestationLabel)}
                  aria-label={`Retirer ${item.prestationLabel}`}
                >
                  <Trash style={{ width: 12, height: 12 }} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
            padding: '8px 12px',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--ink-3)' }}>Total prestations :</span>
          <strong data-testid="prestations-total">{total.toFixed(2)} MAD</strong>
        </div>
      )}
    </div>
  );
}
