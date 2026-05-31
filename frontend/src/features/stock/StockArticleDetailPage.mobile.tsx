/**
 * /stock/articles/:id — Fiche article (mobile 390 px).
 * Header empilé + boutons full-width + sections collapsibles.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useStockArticle } from './hooks/useStockArticle';
import { useStockLots } from './hooks/useStockLots';
import { useStockMovements } from './hooks/useStockMovements';
import { MovementDrawerMobile } from './components/MovementDrawer.mobile';
import { LotInactivateDialog } from './components/LotInactivateDialog';
import { StockArticleFormDrawer } from './components/StockArticleFormDrawer';
import { CATEGORY_LABEL, MOVEMENT_TYPE_LABEL } from './types';
import type { StockMovementType } from './types';

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

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        border: 'none',
        background: 'var(--surface-2)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {title}
      <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
    </button>
  );
}

export default function StockArticleDetailPageMobile() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');
  const canOut = !userRoles.includes('SECRETAIRE') || userRoles.includes('MEDECIN') || userRoles.includes('ADMIN') || userRoles.includes('ASSISTANT');

  const { article, isLoading: articleLoading, error: articleError } = useStockArticle(id);
  const { lots } = useStockLots(article?.tracksLots ? id : undefined, 'ACTIVE');
  const { movements } = useStockMovements(id, { size: 50 });

  const [movDrawerMode, setMovDrawerMode] = useState<StockMovementType | null>(null);
  const [lotToInactivate, setLotToInactivate] = useState<{ id: string; lotNumber: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [lotsOpen, setLotsOpen] = useState(true);
  const [histOpen, setHistOpen] = useState(true);

  if (articleLoading) {
    return (
      <MScreen topbar={<MTopbar title={t('stock.title')} />}>
        <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>
          {t('stock.detail.loadingShort')}
        </div>
      </MScreen>
    );
  }

  if (articleError || !article) {
    return (
      <MScreen topbar={<MTopbar title={t('stock.title')} />}>
        <div style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>
          {articleError ?? t('stock.detail.notFound')}
        </div>
      </MScreen>
    );
  }

  return (
    <MScreen
      topbar={
        <MTopbar
          title={article.label}
          sub={t(CATEGORY_LABEL[article.category])}
          left={
            <button
              type="button"
              onClick={() => navigate('/stock')}
              aria-label={t('stock.back')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                color: 'var(--primary)',
                padding: '0 4px',
              }}
            >
              ‹
            </button>
          }
          right={
            canEdit ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label={t('common.edit')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                {t('common.edit')}
              </button>
            ) : undefined
          }
        />
      }
    >
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header summary */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{t('stock.detail.code')}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{article.code}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{t('stock.detail.qty')}</div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: article.currentQuantity <= article.minThreshold ? 'var(--danger)' : 'var(--ink)',
                  lineHeight: 1,
                }}
              >
                {article.currentQuantity}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>
                  {article.unit}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-2)' }}>
            <span>{t('stock.detail.threshold', { n: article.minThreshold })}</span>
            {article.supplierName && <span>{article.supplierName}</span>}
            {article.location && <span>{article.location}</span>}
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => setMovDrawerMode('IN')}
            style={{
              height: 48,
              border: 'none',
              borderRadius: 'var(--r-md)',
              background: 'var(--status-arrived, #16a34a)',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t('stock.quick.inFull')}
          </button>
          <button
            type="button"
            onClick={() => setMovDrawerMode('OUT')}
            disabled={!canOut}
            style={{
              height: 48,
              border: '1px solid var(--amber, #d97706)',
              borderRadius: 'var(--r-md)',
              background: 'transparent',
              color: 'var(--amber, #d97706)',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: canOut ? 'pointer' : 'not-allowed',
              opacity: canOut ? 1 : 0.5,
            }}
          >
            {t('stock.quick.outFull')}
          </button>
          <button
            type="button"
            onClick={() => setMovDrawerMode('ADJUSTMENT')}
            style={{
              height: 48,
              border: '1px solid var(--primary)',
              borderRadius: 'var(--r-md)',
              background: 'transparent',
              color: 'var(--primary)',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t('stock.quick.adjustFull')}
          </button>
        </div>

        {/* Lots section — medicaments only */}
        {article.tracksLots && (
          <div>
            <SectionHeader
              title={t('stock.lots.titleCount', { n: lots.length })}
              open={lotsOpen}
              onToggle={() => setLotsOpen((v) => !v)}
            />
            {lotsOpen && (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--r-md) var(--r-md)',
                }}
              >
                {lots.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>
                    {t('stock.lots.empty')}
                  </div>
                ) : (
                  lots.map((lot) => {
                    const today = new Date();
                    const exp = new Date(lot.expiresOn + 'T00:00:00');
                    const diffDays = Math.ceil(
                      (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    const isNear = diffDays <= 30;
                    return (
                      <div
                        key={lot.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 600 }}>
                            {lot.lotNumber}
                          </div>
                          <div style={{ fontSize: 12, marginTop: 2 }}>
                            {isNear ? (
                              <span
                                style={{
                                  color: diffDays <= 7 ? 'var(--danger)' : 'var(--amber, #d97706)',
                                  fontWeight: 600,
                                }}
                              >
                                {t('stock.lots.expiryWithDays', { date: formatDate(lot.expiresOn), n: diffDays })}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--ink-3)' }}>{formatDate(lot.expiresOn)}</span>
                            )}
                            <span style={{ marginLeft: 10, color: 'var(--ink-2)' }}>
                              {t('stock.lots.qty', { n: lot.quantity })}
                            </span>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setLotToInactivate({ id: lot.id, lotNumber: lot.lotNumber })
                            }
                            style={{
                              padding: '4px 10px',
                              border: '1px solid var(--danger)',
                              borderRadius: 'var(--r-sm)',
                              background: 'transparent',
                              color: 'var(--danger)',
                              fontSize: 12,
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            {t('stock.lots.inactivate')}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* History section */}
        <div>
          <SectionHeader
            title={t('stock.history.titleCount', { n: movements.length })}
            open={histOpen}
            onToggle={() => setHistOpen((v) => !v)}
          />
          {histOpen && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 var(--r-md) var(--r-md)',
              }}
            >
              {movements.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>
                  {t('stock.history.emptyShort')}
                </div>
              ) : (
                movements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background:
                            m.type === 'IN'
                              ? 'var(--status-arrived-soft, #dcfce7)'
                              : m.type === 'OUT'
                              ? 'var(--amber-soft, #fffbeb)'
                              : 'var(--primary-soft)',
                          color:
                            m.type === 'IN'
                              ? 'var(--status-arrived, #16a34a)'
                              : m.type === 'OUT'
                              ? 'var(--amber, #d97706)'
                              : 'var(--primary)',
                        }}
                      >
                        {t(MOVEMENT_TYPE_LABEL[m.type])}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {m.quantity} {article.unit}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {formatDateTime(m.performedAt)} · {m.performedBy.name}
                    </div>
                    {article.tracksLots && m.lotNumber && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'monospace', marginTop: 2 }}>
                        {t('stock.history.lotLine', { lot: m.lotNumber })}
                      </div>
                    )}
                    {m.reason && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                        {m.reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Movement bottom sheet */}
      {movDrawerMode && (
        <MovementDrawerMobile
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
    </MScreen>
  );
}
