/**
 * /stock/articles/:id — Fiche article détaillée (desktop).
 * Header + mouvements rapides + lots actifs + historique.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { ChevronLeft, ChevronRight, Edit } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useStockArticle } from './hooks/useStockArticle';
import { useStockLots } from './hooks/useStockLots';
import { useStockMovements } from './hooks/useStockMovements';
import { MovementDrawer } from './components/MovementDrawer';
import { LotInactivateDialog } from './components/LotInactivateDialog';
import { StockArticleFormDrawer } from './components/StockArticleFormDrawer';
import { CATEGORY_LABEL, MOVEMENT_TYPE_LABEL } from './types';
import type { StockMovementType } from './types';

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  stock: '/stock',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

function MovementTypePill({ type }: { type: StockMovementType }) {
  const configs: Record<StockMovementType, { bg: string; color: string }> = {
    IN: { bg: 'var(--status-arrived-soft, #dcfce7)', color: 'var(--status-arrived, #16a34a)' },
    OUT: { bg: 'var(--amber-soft, #fffbeb)', color: 'var(--amber, #d97706)' },
    ADJUSTMENT: { bg: 'var(--primary-soft)', color: 'var(--primary)' },
  };
  const { bg, color } = configs[type];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {MOVEMENT_TYPE_LABEL[type]}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExpiryBadge({ expiresOn }: { expiresOn: string }) {
  const today = new Date();
  const exp = new Date(expiresOn + 'T00:00:00');
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(expiresOn)}</span>;
  const color = diffDays <= 7 ? 'var(--danger)' : 'var(--amber, #d97706)';
  const bg = diffDays <= 7 ? 'var(--danger-soft, #fef2f2)' : 'var(--amber-soft, #fffbeb)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: bg, color }}>
      {formatDate(expiresOn)} · {diffDays}j
    </span>
  );
}

export default function StockArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');
  const canOut = !userRoles.includes('SECRETAIRE') || userRoles.includes('MEDECIN') || userRoles.includes('ADMIN') || userRoles.includes('ASSISTANT');

  const { article, isLoading: articleLoading, error: articleError } = useStockArticle(id);
  const { lots, isLoading: lotsLoading } = useStockLots(
    article?.tracksLots ? id : undefined,
    'ACTIVE',
  );

  const [movPage, setMovPage] = useState(0);
  const { movements, totalPages: movTotalPages, currentPage: movCurrentPage, isLoading: movLoading } =
    useStockMovements(id, { page: movPage, size: 50 });

  const [movDrawerMode, setMovDrawerMode] = useState<StockMovementType | null>(null);
  const [lotToInactivate, setLotToInactivate] = useState<{ id: string; lotNumber: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (articleLoading) {
    return (
      <Screen
        active="stock"
        title="Stock interne"
        onNavigate={(navId) => {
          const path = NAV_MAP[navId as keyof typeof NAV_MAP];
          if (path) navigate(path);
        }}
      >
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
          Chargement de la fiche article…
        </div>
      </Screen>
    );
  }

  if (articleError || !article) {
    return (
      <Screen
        active="stock"
        title="Stock interne"
        onNavigate={(navId) => {
          const path = NAV_MAP[navId as keyof typeof NAV_MAP];
          if (path) navigate(path);
        }}
      >
        <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>
          {articleError ?? 'Article introuvable.'}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      active="stock"
      title="Stock interne"
      sub={`${article.label} · Fiche article`}
      onNavigate={(navId) => {
        const path = NAV_MAP[navId as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => navigate('/stock')}>
            <ChevronLeft /> Retour à la liste
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Edit /> Modifier
            </Button>
          )}
        </div>
      }
    >
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header panel */}
        <Panel>
          <div style={{ padding: '20px 24px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Code
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                {article.code}
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Libellé
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {article.label}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Catégorie
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                }}
              >
                {CATEGORY_LABEL[article.category]}
              </span>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Quantité actuelle
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: article.currentQuantity <= article.minThreshold ? 'var(--danger)' : 'var(--ink)',
                  lineHeight: 1,
                }}
              >
                {article.currentQuantity}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>
                  {article.unit}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Seuil min
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
                {article.minThreshold}
              </div>
            </div>

            {article.supplierName && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Fournisseur
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{article.supplierName}</div>
              </div>
            )}

            {article.location && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Emplacement
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{article.location}</div>
              </div>
            )}
          </div>
        </Panel>

        {/* Quick actions */}
        <Panel>
          <PanelHeader>Mouvements rapides</PanelHeader>
          <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
            <Button
              variant="primary"
              onClick={() => setMovDrawerMode('IN')}
            >
              + Entrée
            </Button>
            <Button
              variant="default"
              onClick={() => setMovDrawerMode('OUT')}
              disabled={!canOut}
              style={{ borderColor: 'var(--amber, #d97706)', color: 'var(--amber, #d97706)' }}
            >
              − Sortie
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMovDrawerMode('ADJUSTMENT')}
            >
              Ajuster
            </Button>
          </div>
        </Panel>

        {/* Active lots — medicaments only */}
        {article.tracksLots && (
          <Panel>
            <PanelHeader>Lots actifs</PanelHeader>
            {lotsLoading ? (
              <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>
                Chargement des lots…
              </div>
            ) : lots.length === 0 ? (
              <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>
                Aucun lot actif
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Numéro de lot', 'Péremption', 'Quantité'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          style={{
                            padding: '10px 16px',
                            textAlign: 'left',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        scope="col"
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--ink-3)',
                        }}
                      >
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => (
                      <tr key={lot.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                          {lot.lotNumber}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <ExpiryBadge expiresOn={lot.expiresOn} />
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 650 }}>
                          {lot.quantity}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setLotToInactivate({ id: lot.id, lotNumber: lot.lotNumber })}
                            >
                              Inactiver
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* Movement history */}
        <Panel>
          <PanelHeader>Historique des mouvements</PanelHeader>
          {movLoading ? (
            <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>
              Chargement de l&apos;historique…
            </div>
          ) : movements.length === 0 ? (
            <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun mouvement enregistré
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Type', 'Quantité', ...(article.tracksLots ? ['Lot'] : []), 'Motif', 'Par qui'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'left',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDateTime(m.performedAt)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <MovementTypePill type={m.type} />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 650 }}>
                        {m.quantity}
                      </td>
                      {article.tracksLots && (
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontFamily: 'monospace', fontSize: 12 }}>
                          {m.lotNumber ?? '—'}
                        </td>
                      )}
                      <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 12, maxWidth: 200 }}>
                        {m.reason ?? '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 12 }}>
                        {m.performedBy.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination for movements */}
          {movTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <Button
                size="sm"
                variant="ghost"
                disabled={movCurrentPage === 0}
                onClick={() => setMovPage((p) => p - 1)}
                aria-label="Page précédente"
              >
                <ChevronLeft />
              </Button>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Page {movCurrentPage + 1} / {movTotalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={movCurrentPage >= movTotalPages - 1}
                onClick={() => setMovPage((p) => p + 1)}
                aria-label="Page suivante"
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {/* Movement drawer */}
      {movDrawerMode && (
        <MovementDrawer
          articleId={article.id}
          articleCategory={article.category}
          articleLabel={article.label}
          currentQuantity={article.currentQuantity}
          mode={movDrawerMode}
          open={Boolean(movDrawerMode)}
          onClose={() => setMovDrawerMode(null)}
        />
      )}

      {/* Lot inactivate dialog */}
      {lotToInactivate && id && (
        <LotInactivateDialog
          articleId={id}
          lotId={lotToInactivate.id}
          lotNumber={lotToInactivate.lotNumber}
          open={Boolean(lotToInactivate)}
          onClose={() => setLotToInactivate(null)}
        />
      )}

      {/* Edit article drawer */}
      <StockArticleFormDrawer
        mode="edit"
        article={article}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </Screen>
  );
}
