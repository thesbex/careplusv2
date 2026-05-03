/**
 * Modale "Certificat médical" — crée un Prescription type=CERT avec
 * une seule ligne `freeText = corps du certificat`, puis ouvre le PDF.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';

interface CertificatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  onCreated?: (prescriptionId: string) => void;
}

const TEMPLATES: { label: string; body: string }[] = [
  {
    label: 'Aptitude',
    body:
      "Le patient est en bonne santé et apte à reprendre toutes ses activités " +
      "professionnelles et sportives habituelles, sans contre-indication médicale.",
  },
  {
    label: 'Présence en consultation',
    body:
      "Le patient s'est présenté à mon cabinet ce jour pour consultation médicale.",
  },
  {
    label: 'Repos',
    body:
      "L'état de santé du patient nécessite un repos de … jours à compter de ce jour. " +
      "Sortie autorisée.",
  },
];

export function CertificatDialog({
  open, onOpenChange, consultationId, onCreated,
}: CertificatDialogProps) {
  const [body, setBody] = useState('');
  const qc = useQueryClient();

  useEffect(() => { if (open) setBody(''); }, [open]);

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
      void api
        .get(`/prescriptions/${created.id}/pdf`, { responseType: 'blob' })
        .then((r) => {
          const url = URL.createObjectURL(r.data as Blob);
          window.open(url, '_blank', 'noopener,noreferrer');
        })
        .catch(() => toast.error('Aperçu PDF impossible.'));
      onCreated?.(created.id);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Création du certificat refusée.';
      toast.error(msg);
    },
  });

  function submit() {
    if (body.trim().length < 10) {
      toast.error('Le corps du certificat doit faire au moins 10 caractères.');
      return;
    }
    mutation.mutate();
  }

  return (
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
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setBody(t.body)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Modèle : {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Saisissez le corps du certificat…"
            rows={9}
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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              onClick={submit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Génération…' : 'Générer le certificat'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
