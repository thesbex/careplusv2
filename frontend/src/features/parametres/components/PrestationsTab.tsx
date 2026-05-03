/**
 * Onglet « Prestations » dans /parametres (V016).
 *
 * - Liste catalogue (incluant désactivées) avec inline edit du label,
 *   du prix par défaut, et toggle actif.
 * - Bouton « Nouvelle prestation » qui ajoute une ligne vide en haut
 *   (mode création).
 * - Bouton ⌫ par ligne déclenche un soft-delete (active=false).
 *
 * Les erreurs API (409 PRESTATION_CODE_DUPLICATE notamment) sont
 * surfacées en toast avec la cause.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Trash } from '@/components/icons';
import { usePrestationCatalog } from '@/features/prestation/hooks/usePrestations';
import {
  useCreatePrestation,
  useDeactivatePrestation,
  useUpdatePrestation,
  type PrestationFormPayload,
} from '@/features/prestation/hooks/usePrestationAdmin';
import type { PrestationApi } from '@/features/prestation/types';

const EMPTY: PrestationFormPayload = {
  code: '',
  label: '',
  defaultPrice: 0,
  active: true,
  sortOrder: 0,
};

interface RowProps {
  prestation: PrestationApi;
}

function Row({ prestation }: RowProps) {
  const [draft, setDraft] = useState<PrestationFormPayload>({
    code: prestation.code,
    label: prestation.label,
    defaultPrice: prestation.defaultPrice,
    active: prestation.active,
    sortOrder: prestation.sortOrder,
  });
  const [editing, setEditing] = useState(false);
  const { update, isPending: saving } = useUpdatePrestation();
  const { deactivate, isPending: deleting } = useDeactivatePrestation();
  const dirty =
    draft.code !== prestation.code
    || draft.label !== prestation.label
    || draft.defaultPrice !== prestation.defaultPrice
    || draft.active !== prestation.active
    || draft.sortOrder !== prestation.sortOrder;

  async function onSave() {
    try {
      await update({ id: prestation.id, payload: draft });
      toast.success(`${draft.label} mis à jour.`);
      setEditing(false);
    } catch (err) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 409) toast.error('Code déjà utilisé.');
      else toast.error('Échec de la sauvegarde.');
    }
  }

  async function onDeactivate() {
    if (!confirm(`Désactiver « ${prestation.label} » ?`)) return;
    try {
      await deactivate(prestation.id);
      toast.success('Prestation désactivée.');
    } catch {
      toast.error('Échec de la désactivation.');
    }
  }

  return (
    <tr style={{ opacity: prestation.active ? 1 : 0.55 }}>
      <td style={{ padding: '6px 8px' }}>
        <Input
          value={draft.code}
          onChange={(e) => { setDraft({ ...draft, code: e.target.value }); setEditing(true); }}
          aria-label={`Code ${prestation.label}`}
        />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <Input
          value={draft.label}
          onChange={(e) => { setDraft({ ...draft, label: e.target.value }); setEditing(true); }}
          aria-label={`Libellé ${prestation.code}`}
        />
      </td>
      <td style={{ padding: '6px 8px', width: 120 }}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={draft.defaultPrice}
          onChange={(e) => { setDraft({ ...draft, defaultPrice: Number(e.target.value) || 0 }); setEditing(true); }}
          aria-label={`Tarif ${prestation.label}`}
        />
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => { setDraft({ ...draft, active: e.target.checked }); setEditing(true); }}
          aria-label={`Actif ${prestation.label}`}
        />
      </td>
      <td style={{ padding: '6px 8px', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {dirty && (
          <Button type="button" variant="primary" size="sm" disabled={saving} onClick={onSave}>
            Enregistrer
          </Button>
        )}
        {editing && !dirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Fermer
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deleting || !prestation.active}
          onClick={onDeactivate}
          aria-label={`Supprimer ${prestation.label}`}
        >
          <Trash style={{ width: 12, height: 12 }} />
        </Button>
      </td>
    </tr>
  );
}

export function PrestationsTab() {
  const { prestations, isLoading } = usePrestationCatalog(true); // include inactive
  const { create, isPending: creating } = useCreatePrestation();
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<PrestationFormPayload>(EMPTY);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create(draft);
      toast.success(`${draft.label} ajoutée.`);
      setDraft(EMPTY);
      setShowCreate(false);
    } catch (err) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 409) toast.error('Code déjà utilisé.');
      else if (status === 400) toast.error('Champs obligatoires manquants ou invalides.');
      else toast.error('Échec de la création.');
    }
  }

  return (
    <Panel data-testid="prestations-tab">
      <PanelHeader>
        Catalogue des prestations
        <span style={{ flex: 1 }} />
        <Button type="button" variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Annuler' : 'Nouvelle prestation'}
        </Button>
      </PanelHeader>

      {showCreate && (
        <form
          onSubmit={(e) => { void onCreate(e); }}
          style={{ padding: 16, display: 'grid', gridTemplateColumns: '120px 1fr 120px auto', gap: 8, alignItems: 'end' }}
        >
          <Field>
            <FieldLabel htmlFor="new-code">Code *</FieldLabel>
            <Input id="new-code" value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="ECG" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-label">Libellé *</FieldLabel>
            <Input id="new-label" value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Électrocardiogramme" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-price">Tarif (MAD) *</FieldLabel>
            <Input id="new-price" type="number" min={0} step="0.01" value={draft.defaultPrice}
              onChange={(e) => setDraft({ ...draft, defaultPrice: Number(e.target.value) || 0 })} />
          </Field>
          <Button type="submit" variant="primary" disabled={creating || !draft.code || !draft.label}>
            Ajouter
          </Button>
        </form>
      )}

      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--ink-3)' }}>Chargement…</div>
      ) : (
        <div style={{ padding: 16, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 11 }}>
                <th style={{ padding: '6px 8px' }}>Code</th>
                <th style={{ padding: '6px 8px' }}>Libellé</th>
                <th style={{ padding: '6px 8px', width: 120 }}>Tarif (MAD)</th>
                <th style={{ padding: '6px 8px', width: 60, textAlign: 'center' }}>Actif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prestations.map((p) => <Row key={p.id} prestation={p} />)}
              {prestations.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: 'var(--ink-3)' }}>
                    Aucune prestation. Cliquer « Nouvelle prestation » pour démarrer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
