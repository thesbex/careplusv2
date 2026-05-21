/**
 * V046 — section "Mes confrères" dans /profil.
 *
 * Carnet personnel de confrères vers qui le médecin oriente ses patients,
 * filtrable par spécialité. CRUD inline (pas de dialog dédié — formulaire
 * apparaît au-dessus de la liste à la création / édition).
 *
 * Affichage : groupé par spécialité, ordre serveur. Pas d'orientation
 * automatique en v1 — la consommation (lettre d'orientation) sortira plus
 * tard.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Trash } from '@/components/icons';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { MEDICAL_SPECIALTIES, SPECIALTY_OTHER } from '@/lib/catalogs/medicalSpecialties';
import {
  useCreateReferralContact,
  useDeleteReferralContact,
  useReferralContacts,
  useUpdateReferralContact,
  type ReferralContact,
  type ReferralContactInput,
} from '../hooks/useReferralContacts';

const ALL = '__ALL__';

const emptyDraft: ReferralContactInput = {
  fullName: '',
  specialty: '',
  phone: '',
  city: '',
  notes: '',
};

export function ReferralContactsSection() {
  const isMobile = useIsMobile();
  const { contacts, isLoading, error } = useReferralContacts();
  const { create, isPending: isCreating } = useCreateReferralContact();
  const { update, isPending: isUpdating } = useUpdateReferralContact();
  const { remove, isPending: isDeleting } = useDeleteReferralContact();

  const [filter, setFilter] = useState<string>(ALL);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReferralContact | null>(null);
  const [draft, setDraft] = useState<ReferralContactInput>(emptyDraft);

  const specialties = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => s.add(c.specialty));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [contacts]);

  const visible = useMemo(
    () => (filter === ALL ? contacts : contacts.filter((c) => c.specialty === filter)),
    [contacts, filter],
  );

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setShowForm(true);
  }

  function openEdit(c: ReferralContact) {
    setEditing(c);
    setDraft({
      fullName: c.fullName,
      specialty: c.specialty,
      phone: c.phone ?? '',
      city: c.city ?? '',
      notes: c.notes ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setDraft(emptyDraft);
  }

  async function handleSubmit() {
    if (!draft.fullName.trim()) {
      toast.error('Nom complet requis.');
      return;
    }
    if (!draft.specialty.trim()) {
      toast.error('Spécialité requise.');
      return;
    }
    const payload: ReferralContactInput = {
      fullName: draft.fullName.trim(),
      specialty: draft.specialty.trim(),
      phone: draft.phone?.trim() || '',
      city: draft.city?.trim() || '',
      notes: draft.notes?.trim() || '',
    };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success('Confrère mis à jour.');
      } else {
        await create(payload);
        toast.success('Confrère ajouté.');
      }
      closeForm();
    } catch {
      toast.error("Échec de l'enregistrement.");
    }
  }

  async function handleDelete(c: ReferralContact) {
    if (!window.confirm(`Supprimer ${c.fullName} de votre carnet ?`)) return;
    try {
      await remove(c.id);
      toast.success('Confrère supprimé.');
    } catch {
      toast.error('Échec de la suppression.');
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
      }}
      data-testid="referral-contacts-section"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Mes confrères</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Carnet personnel pour orienter vos patients vers d'autres spécialistes.
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => (showForm ? closeForm() : openCreate())}
        >
          {showForm ? 'Fermer' : 'Nouveau confrère'}
        </Button>
      </div>

      {showForm && (
        <div
          data-testid="referral-form"
          style={{
            padding: 14,
            border: '1px solid var(--primary)',
            background: 'var(--primary-soft)',
            borderRadius: 8,
            marginBottom: 14,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 10,
          }}
        >
          <Field>
            <FieldLabel htmlFor="ref-fullname">Nom complet *</FieldLabel>
            <Input
              id="ref-fullname"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              maxLength={160}
              placeholder="Dr Hassan Cherkaoui"
            />
          </Field>
          <SpecialtyPicker
            value={draft.specialty}
            onChange={(v) => setDraft({ ...draft, specialty: v })}
            extraOptions={specialties}
          />
          <Field>
            <FieldLabel htmlFor="ref-phone">Téléphone</FieldLabel>
            <Input
              id="ref-phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              maxLength={40}
              placeholder="+212 5 22 ..."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ref-city">Ville</FieldLabel>
            <Input
              id="ref-city"
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              maxLength={120}
              placeholder="Casablanca"
            />
          </Field>
          <Field style={{ gridColumn: '1 / -1' }}>
            <FieldLabel htmlFor="ref-notes">Notes</FieldLabel>
            <textarea
              id="ref-notes"
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              maxLength={4000}
              placeholder="Pratique privée, accepte CNOPS, joignable matin uniquement…"
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 8,
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
                background: 'var(--surface)',
              }}
            />
          </Field>
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <Button onClick={closeForm} disabled={isCreating || isUpdating}>
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={isCreating || isUpdating}
              onClick={() => void handleSubmit()}
            >
              {editing
                ? isUpdating
                  ? 'Enregistrement…'
                  : 'Enregistrer'
                : isCreating
                ? 'Création…'
                : 'Créer'}
            </Button>
          </div>
        </div>
      )}

      {/* Filter — only if at least 1 specialty exists */}
      {specialties.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--ink-3)' }}>Spécialité :</span>
          <select
            aria-label="Filtrer par spécialité"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 12,
              fontFamily: 'inherit',
              background: 'var(--surface)',
            }}
          >
            <option value={ALL}>Toutes ({contacts.length})</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s} ({contacts.filter((c) => c.specialty === s).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>
      )}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>
      )}
      {!isLoading && visible.length === 0 && (
        <div
          style={{
            padding: 18,
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--ink-3)',
          }}
        >
          {contacts.length === 0
            ? 'Aucun confrère encore enregistré. Commencez par « Nouveau confrère ».'
            : 'Aucun confrère pour cette spécialité.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.fullName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                {c.specialty}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.city ? ` · ${c.city}` : ''}
              </div>
              {c.notes && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-2)',
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {c.notes}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Modifier ${c.fullName}`}
              onClick={() => openEdit(c)}
            >
              Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Supprimer ${c.fullName}`}
              disabled={isDeleting}
              onClick={() => void handleDelete(c)}
            >
              <Trash />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Picker spécialité = select avec le catalogue prédéfini (MEDICAL_SPECIALTIES)
 * + les spécialités déjà saisies par le médecin (déduplication) + une option
 * "Autre…" qui révèle un champ libre.
 *
 * Pourquoi pas juste `<input list=...>` (autocomplete natif) : on veut FORCER
 * le choix dans le catalogue par défaut, avec saisie libre disponible mais
 * volontaire. Retour terrain Excel : "je veux selectionner parmis celles
 * existantes dans le marché (cardiologue, hématologue, pédiatre, ..)".
 */
function SpecialtyPicker({
  value,
  onChange,
  extraOptions,
}: {
  value: string;
  onChange: (v: string) => void;
  extraOptions: readonly string[];
}) {
  // Catalogue final = MEDICAL_SPECIALTIES ∪ saisies historiques du médecin.
  const allOptions = useMemo(() => {
    const set = new Set<string>(MEDICAL_SPECIALTIES);
    extraOptions.forEach((s) => {
      if (s && s.trim()) set.add(s.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [extraOptions]);

  // Si la valeur courante n'est pas dans le catalogue, le mode "Autre" est
  // automatiquement actif (cas d'une saisie libre faite avant l'arrivée du
  // catalogue, ou édition d'un confrère déjà créé en libre).
  const isInCatalog = value === '' || allOptions.includes(value);
  const [mode, setMode] = useState<'select' | 'free'>(isInCatalog ? 'select' : 'free');

  useEffect(() => {
    setMode(isInCatalog ? 'select' : 'free');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Field>
      <FieldLabel htmlFor="ref-specialty">Spécialité *</FieldLabel>
      {mode === 'select' ? (
        <select
          id="ref-specialty"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === SPECIALTY_OTHER) {
              setMode('free');
              onChange('');
            } else {
              onChange(v);
            }
          }}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
            fontFamily: 'inherit',
            fontSize: 14,
            color: 'var(--ink)',
          }}
        >
          <option value="">— Sélectionner —</option>
          {allOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={SPECIALTY_OTHER}>Autre… (saisir)</option>
        </select>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            id="ref-specialty"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={120}
            placeholder="Saisir la spécialité"
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); onChange(''); }}>
            ↩ Liste
          </Button>
        </div>
      )}
    </Field>
  );
}
