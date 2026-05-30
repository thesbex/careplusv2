/**
 * Onglet "Modèles d'ordonnance" dans Paramétrage (QA6-2 + QA6-3).
 * Sub-tabs DRUG / LAB / IMAGING. Tableau avec actions Modifier / Supprimer.
 * Bouton +Nouveau ouvre PrescriptionTemplateDrawer en mode création.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Trash } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  usePrescriptionTemplates,
  useDeletePrescriptionTemplate,
  type PrescriptionTemplate,
  type TemplateType,
} from '../hooks/usePrescriptionTemplates';
import { PrescriptionTemplateDrawer } from './PrescriptionTemplateDrawer';

const SUBTABS: { id: TemplateType; labelKey: string }[] = [
  { id: 'DRUG', labelKey: 'settings.tpl.drug' },
  { id: 'LAB', labelKey: 'settings.tpl.lab' },
  { id: 'IMAGING', labelKey: 'settings.tpl.imaging' },
];

export function PrescriptionTemplatesTab() {
  const { t: tr } = useT();
  const [subtab, setSubtab] = useState<TemplateType>('DRUG');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PrescriptionTemplate | null>(null);

  const { templates, isLoading, error } = usePrescriptionTemplates(subtab);
  const { remove } = useDeletePrescriptionTemplate();

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(t: PrescriptionTemplate) {
    setEditing(t);
    setDrawerOpen(true);
  }
  async function handleDelete(t: PrescriptionTemplate) {
    if (!confirm(tr('settings.tpl.confirmDelete', { name: t.name }))) return;
    try {
      await remove(t.id);
      toast.success(tr('settings.tpl.deleted'));
    } catch {
      toast.error(tr('settings.tpl.deleteErr'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', gap: 6 }} role="tablist" aria-label={tr('settings.tpl.typeAria')}>
          {SUBTABS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={subtab === s.id}
              onClick={() => setSubtab(s.id)}
              style={{
                padding: '6px 14px',
                border: '1px solid var(--border)',
                borderRadius: 999,
                background: subtab === s.id ? 'var(--primary)' : 'var(--surface)',
                color: subtab === s.id ? 'white' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 550,
                cursor: 'pointer',
              }}
            >
              {tr(s.labelKey)}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus /> {tr('settings.tpl.new')}
        </Button>
      </div>

      <Panel style={{ overflow: 'auto', padding: 0 }}>
        {isLoading && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{tr('common.loading')}</div>
        )}
        {error && (
          <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
        )}
        {!isLoading && !error && templates.length === 0 && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
            {tr('settings.tpl.empty')}
          </div>
        )}
        {templates.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <Th>{tr('settings.tpl.colName')}</Th>
                <Th style={{ width: 100, textAlign: 'right' }}>{tr('settings.tpl.colLines')}</Th>
                <Th style={{ width: 180 }}>{tr('settings.tpl.colUpdated')}</Th>
                <Th style={{ width: 120 }}> </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                  </Td>
                  <Td style={{ textAlign: 'right' }} className="tnum">{t.lineCount}</Td>
                  <Td style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                    {new Date(t.updatedAt).toLocaleString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 11.5,
                          padding: '4px 8px',
                          borderRadius: 4,
                          color: 'var(--primary)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {tr('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleDelete(t); }}
                        aria-label={`${tr('common.delete')} ${t.name}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          padding: 4,
                          lineHeight: 0,
                        }}
                      >
                        <Trash />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <PrescriptionTemplateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        type={subtab}
        template={editing}
      />
    </div>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 14px',
        fontWeight: 600,
        fontSize: 11.5,
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, style, className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td className={className} style={{ padding: '8px 14px', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  );
}
