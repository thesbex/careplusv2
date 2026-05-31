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
import { useT } from '@/lib/i18n/I18nProvider';

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
  const { t } = useT();
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
      .catch(() => setError(t('settings.backup.listError')))
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
      toast.success(t('settings.backup.restoreDone'), { description: res.message });
      setTarget(null);
      setConfirmText('');
    } catch (err) {
      const ax = err as { response?: { data?: { detail?: string; title?: string } } };
      toast.error(t('settings.backup.restoreErr'), {
        description: ax.response?.data?.detail ?? ax.response?.data?.title,
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Panel data-testid="backup-restore-panel">
      <PanelHeader>
        <span>{t('settings.backup.title')}</span>
        <Button size="sm" style={{ marginLeft: 'auto' }} onClick={refresh} disabled={loading}>
          {loading ? t('common.loading') : t('settings.backup.refresh')}
        </Button>
      </PanelHeader>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('settings.backup.hint')}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

        {!error && files.length === 0 && !loading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
            {t('settings.backup.empty')}
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
                  {t('settings.backup.restore')}
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
          aria-label={t('settings.backup.confirmAria')}
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
              {t('settings.backup.confirmTitle')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              {t('settings.backup.confirmBody', {
                file: target.name,
                keyword: t('settings.backup.confirmKeyword'),
              })}
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('settings.backup.confirmKeyword')}
              aria-label={t('settings.backup.confirmInputAria')}
              style={{
                height: 36, padding: '0 10px', border: '1px solid var(--border)',
                borderRadius: 6, fontFamily: 'inherit', fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setTarget(null)} disabled={restoring}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                disabled={restoring || confirmText !== t('settings.backup.confirmKeyword')}
                onClick={() => void doRestore()}
              >
                {restoring ? t('common.saving') : t('settings.backup.confirmDo')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
