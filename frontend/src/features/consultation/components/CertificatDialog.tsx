/**
 * Modale "Certificat médical" — crée un Prescription type=CERT avec
 * une seule ligne `freeText = corps du certificat`, puis ouvre le PDF.
 *
 * F10 — modèle "Repos" : champs structurés (jours / date début / sortie
 * autorisée). Le `body` envoyé au backend est généré à partir des champs
 * pour éviter le placeholder "…" dans le PDF.
 */
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';
import { PdfGenerationOverlay } from '@/features/prescription/components/PdfGenerationOverlay';

interface CertificatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  onCreated?: (prescriptionId: string) => void;
}

type TemplateKind = 'APTITUDE' | 'PRESENCE' | 'REPOS' | null;

const TEMPLATES: { kind: Exclude<TemplateKind, null>; label: string; body: string }[] = [
  {
    kind: 'APTITUDE',
    label: 'Aptitude',
    body:
      "Le patient est en bonne santé et apte à reprendre toutes ses activités " +
      "professionnelles et sportives habituelles, sans contre-indication médicale.",
  },
  {
    kind: 'PRESENCE',
    label: 'Présence en consultation',
    body:
      "Le patient s'est présenté à mon cabinet ce jour pour consultation médicale.",
  },
  {
    kind: 'REPOS',
    label: 'Repos',
    body: '', // body généré dynamiquement à partir des champs structurés
  },
];

/** Aujourd'hui en YYYY-MM-DD (composantes locales — ne pas utiliser toISOString). */
function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ajoute `days` jours à une date YYYY-MM-DD, renvoie YYYY-MM-DD. */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Formate YYYY-MM-DD en DD/MM/YYYY pour le texte certificat. */
function formatFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Génère le corps texte structuré pour le modèle Repos. */
function buildRestBody(days: number, startIso: string, allowsOuting: boolean): string {
  const endIso = addDaysIso(startIso, Math.max(0, days - 1));
  const startFr = formatFr(startIso);
  const endFr = formatFr(endIso);
  const dayLabel = days <= 1 ? 'jour' : 'jours';
  const outing = allowsOuting ? 'Sortie autorisée.' : 'Sortie non autorisée.';
  return (
    `L'état de santé du patient nécessite un repos de ${days} ${dayLabel} ` +
    `du ${startFr} au ${endFr} inclus. ${outing}`
  );
}

export function CertificatDialog({
  open, onOpenChange, consultationId, onCreated,
}: CertificatDialogProps) {
  const [body, setBody] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<TemplateKind>(null);

  // F10 — champs structurés pour modèle "Repos".
  const [restDays, setRestDays] = useState<number>(3);
  const [restStartDate, setRestStartDate] = useState<string>(todayLocalIso());
  const [restAllowsOuting, setRestAllowsOuting] = useState<boolean>(true);

  // F9 — overlay couvrant POST + fetch PDF (les deux ont une latence
  // serveur perceptible : openhtmltopdf + Thymeleaf sur le second appel).
  const [generating, setGenerating] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setBody('');
      setActiveTemplate(null);
      setRestDays(3);
      setRestStartDate(todayLocalIso());
      setRestAllowsOuting(true);
    }
  }, [open]);

  // Quand on est sur le modèle Repos, le body suit les champs structurés.
  useEffect(() => {
    if (activeTemplate === 'REPOS') {
      setBody(buildRestBody(restDays, restStartDate, restAllowsOuting));
    }
  }, [activeTemplate, restDays, restStartDate, restAllowsOuting]);

  const restEndDate = useMemo(
    () => addDaysIso(restStartDate, Math.max(0, restDays - 1)),
    [restStartDate, restDays],
  );

  const restValid = restDays >= 1 && restDays <= 30 && /^\d{4}-\d{2}-\d{2}$/.test(restStartDate);

  function pickTemplate(kind: Exclude<TemplateKind, null>) {
    setActiveTemplate(kind);
    if (kind === 'REPOS') {
      setBody(buildRestBody(restDays, restStartDate, restAllowsOuting));
    } else {
      const tmpl = TEMPLATES.find((t) => t.kind === kind);
      setBody(tmpl?.body ?? '');
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>(`/consultations/${consultationId}/prescriptions`, {
        type: 'CERT',
        lines: [{ freeText: body.trim() }],
        allergyOverride: false,
      }).then((r) => r.data),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['prescriptions'] });
      toast.success('Certificat généré.');
      // Ouvre le PDF dans un nouvel onglet (fetch + blob — l'auth Bearer
      // est sur l'instance axios, on ne peut pas mettre direct dans <a href>).
      // L'overlay reste visible pendant ce 2e appel.
      void api
        .get(`/prescriptions/${created.id}/pdf`, { responseType: 'blob' })
        .then((r) => {
          const url = URL.createObjectURL(r.data as Blob);
          window.open(url, '_blank', 'noopener,noreferrer');
        })
        .catch(() => toast.error('Aperçu PDF impossible.'))
        .finally(() => setGenerating(false));
      onCreated?.(created.id);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      setGenerating(false);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Création du certificat refusée.';
      toast.error(msg);
    },
  });

  const restGuardActive = activeTemplate === 'REPOS' && !restValid;
  const submitDisabled = generating || mutation.isPending || restGuardActive;

  function submit() {
    if (activeTemplate === 'REPOS' && !restValid) {
      toast.error('Saisissez un nombre de jours entre 1 et 30 et une date de début valide.');
      return;
    }
    if (body.trim().length < 10) {
      toast.error('Le corps du certificat doit faire au moins 10 caractères.');
      return;
    }
    setGenerating(true);
    mutation.mutate();
  }

  return (
    <>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: 22,
            width: 'min(560px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              Certificat médical
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
            Le certificat est généré en PDF avec en-tête cabinet + INPE/CNOM, et
            le corps que vous saisissez ci-dessous.
          </Dialog.Description>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {TEMPLATES.map((t) => {
              const active = activeTemplate === t.kind;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => pickTemplate(t.kind)}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 'var(--r-lg)',
                    border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
                    background: active ? 'var(--brand-50, #eff6ff)' : 'var(--surface)',
                    color: active ? 'var(--brand)' : 'var(--ink-2)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Modèle : {t.label}
                </button>
              );
            })}
          </div>

          {activeTemplate === 'REPOS' && (
            <div
              data-testid="rest-fields"
              style={{
                background: 'var(--surface-2, #f8fafc)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12,
                marginBottom: 10,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                    Nombre de jours <span style={{ color: 'var(--danger, #dc2626)' }}>*</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={restDays}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRestDays(Number.isFinite(v) ? v : 0);
                    }}
                    aria-label="Nombre de jours de repos"
                    style={{
                      height: 34,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Date de début</span>
                  <input
                    type="date"
                    value={restStartDate}
                    onChange={(e) => setRestStartDate(e.target.value)}
                    aria-label="Date de début du repos"
                    style={{
                      height: 34,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={restAllowsOuting}
                  onChange={(e) => setRestAllowsOuting(e.target.checked)}
                  aria-label="Sortie autorisée"
                />
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Sortie autorisée</span>
              </label>

              <div
                data-testid="rest-end-preview"
                style={{
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                Date de fin (incluse) : <strong style={{ color: 'var(--ink-1)' }}>
                  {restValid ? formatFr(restEndDate) : '—'}
                </strong>
              </div>

              {!restValid && (
                <div role="alert" style={{ fontSize: 11.5, color: 'var(--danger, #dc2626)' }}>
                  Saisissez un nombre de jours entre 1 et 30.
                </div>
              )}
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Saisissez le corps du certificat…"
            rows={9}
            aria-label="Corps du certificat"
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 10,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          {activeTemplate === 'REPOS' && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
              Le corps est synchronisé avec les champs ci-dessus. Vous pouvez l'éditer ensuite.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              onClick={submit}
              disabled={submitDisabled}
            >
              {generating || mutation.isPending ? 'Génération…' : 'Générer le certificat'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <PdfGenerationOverlay open={generating} type="CERT" />
    </>
  );
}
