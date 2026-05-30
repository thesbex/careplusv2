/**
 * Écran « Sauvegarde & restauration » de la base — réservé au SUPER_ADMIN (V069).
 *
 * Liste les sauvegardes (.dump) du disque configuré côté serveur et permet d'en
 * restaurer une. La restauration est DESTRUCTIVE (remplace les données) : double
 * confirmation obligatoire (saisie du mot « RESTAURER »), et l'utilisateur est
 * invité à redémarrer l'application ensuite.
 *
 * Les sauvegardes sont produites par le batch quotidien
 * (scripts/backup/careplus-backup.ps1, planifié via le Planificateur Windows).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

interface BackupFile {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BackupRestorePanel() {
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<BackupFile | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  function refresh() {
    setLoading(true);
    setError(null);
    api
      .get<BackupFile[]>('/admin/backups')
      .then((r) => setFiles(r.data))
      .catch(() => setError('Impossible de lister les sauvegardes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isSuperAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  // Réservé au super administrateur.
  if (!isSuperAdmin) return null;

  async function doRestore() {
    if (!target) return;
    setRestoring(true);
    try {
      const res = await api
        .post<{ message: string }>('/admin/backups/restore', { fileName: target.name })
        .then((r) => r.data);
      toast.success('Restauration terminée.', { description: res.message });
      setTarget(null);
      setConfirmText('');
    } catch (err) {
      const ax = err as { response?: { data?: { detail?: string; title?: string } } };
      toast.error('Restauration impossible', {
        description: ax.response?.data?.detail ?? ax.response?.data?.title,
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Panel data-testid="backup-restore-panel">
      <PanelHeader>
        <span>Sauvegarde &amp; restauration de la base</span>
        <Button size="sm" style={{ marginLeft: 'auto' }} onClick={refresh} disabled={loading}>
          {loading ? 'Chargement…' : 'Rafraîchir'}
        </Button>
      </PanelHeader>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
          Les sauvegardes sont générées automatiquement chaque jour vers le disque externe
          configuré. La restauration <strong>remplace l'intégralité des données</strong> par la
          sauvegarde choisie — opération irréversible, à n'effectuer qu'en cas de besoin. Un
          redémarrage de l'application est recommandé après une restauration.
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

        {!error && files.length === 0 && !loading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
            Aucune sauvegarde trouvée dans le dossier configuré.
          </div>
        )}

        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((f) => (
              <div
                key={f.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {formatSize(f.sizeBytes)} · {new Date(f.modifiedAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => { setTarget(f); setConfirmText(''); }}
                >
                  Restaurer
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {target && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la restauration"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'grid', placeItems: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setTarget(null); }}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--danger)',
              borderRadius: 10, width: 'min(460px, calc(100vw - 32px))', padding: 18,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>
              Restauration destructive
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Vous allez remplacer <strong>toutes les données actuelles</strong> par la sauvegarde{' '}
              <span className="mono">{target.name}</span>. Cette action est{' '}
              <strong>irréversible</strong>. Pour confirmer, saisissez{' '}
              <strong>RESTAURER</strong> ci-dessous.
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTAURER"
              aria-label="Confirmation"
              style={{
                height: 36, padding: '0 10px', border: '1px solid var(--border)',
                borderRadius: 6, fontFamily: 'inherit', fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setTarget(null)} disabled={restoring}>Annuler</Button>
              <Button
                variant="danger"
                disabled={restoring || confirmText !== 'RESTAURER'}
                onClick={() => void doRestore()}
              >
                {restoring ? 'Restauration…' : 'Restaurer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
