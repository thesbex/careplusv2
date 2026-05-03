/**
 * /stock — Liste des articles de stock (mobile 390 px).
 * Cartes empilées au lieu du tableau desktop.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import { useAuthStore } from '@/lib/auth/authStore';
import { useStockArticles } from './hooks/useStockArticles';
import { useStockSuppliers } from './hooks/useStockSuppliers';
import { StockArticleFormDrawer } from './components/StockArticleFormDrawer';
import { CATEGORY_LABEL } from './types';
import type { StockArticle, StockArticleCategory } from './types';

const CATEGORIES: StockArticleCategory[] = [
  'MEDICAMENT_INTERNE',
  'DOSSIER_PHYSIQUE',
  'CONSOMMABLE',
];

function ExpiryBadge({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return null;
  const today = new Date();
  const exp = new Date(expiresOn + 'T00:00:00');
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return null;
  const color = diffDays <= 7 ? 'var(--danger)' : 'var(--amber, #d97706)';
  const bg = diffDays <= 7 ? 'var(--danger-soft, #fef2f2)' : 'var(--amber-soft, #fffbeb)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: bg, color }}>
      Périme dans {diffDays}j
    </span>
  );
}

export default function StockArticlesPageMobile() {
  const navigate = useNavigate();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [belowThreshold, setBelowThreshold] = useState(false);
  const [qInput, setQInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<StockArticle | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { articles, totalElements, totalPages, currentPage, isLoading, error } = useStockArticles({
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(supplierFilter ? { supplierId: supplierFilter } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(belowThreshold ? { belowThreshold: true } : {}),
    page,
    size: 20,
  });

  const { suppliers } = useStockSuppliers();

  function openCreate() {
    setEditArticle(undefined);
    setFormOpen(true);
  }

  return (
    <MScreen
      topbar={
        <MTopbar
          title="Stock interne"
          sub={`${totalElements} article${totalElements !== 1 ? 's' : ''}`}
          right={
            canEdit ? (
              <button
                type="button"
                onClick={openCreate}
                aria-label="Ajouter article"
                style={{
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                + Ajouter
              </button>
            ) : undefined
          }
        />
      }
    >
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            type="button"
            onClick={() => { setCategoryFilter(''); setPage(0); }}
            style={{
              padding: '5px 12px',
              border: '1px solid var(--border)',
              borderRadius: 999,
              background: !categoryFilter ? 'var(--primary)' : 'var(--surface)',
              color: !categoryFilter ? 'white' : 'var(--ink-2)',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 550,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Tous
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setCategoryFilter(categoryFilter === cat ? '' : cat); setPage(0); }}
              style={{
                padding: '5px 12px',
                border: '1px solid var(--border)',
                borderRadius: 999,
                background: categoryFilter === cat ? 'var(--primary)' : 'var(--surface)',
                color: categoryFilter === cat ? 'white' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 550,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Search + filters row */}
        <input
          type="search"
          value={qInput}
          onChange={(e) => { setQInput(e.target.value); setPage(0); }}
          placeholder="Rechercher code / libellé…"
          aria-label="Recherche article"
          style={{
            height: 40,
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '0 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            background: 'var(--surface)',
            color: 'var(--ink)',
          }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setPage(0); }}
            aria-label="Filtrer par fournisseur"
            style={{
              height: 36,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '0 8px',
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'var(--surface)',
              color: 'var(--ink)',
              flex: 1,
            }}
          >
            <option value="">Tous fournisseurs</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={belowThreshold}
              onChange={(e) => { setBelowThreshold(e.target.checked); setPage(0); }}
            />
            Seuil dépassé
          </label>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-soft, #fef2f2)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 80,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && articles.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Aucun article trouvé
          </div>
        )}

        {/* Article cards */}
        {!isLoading && articles.map((a) => (
          <div
            key={a.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace', marginTop: 2 }}>
                  {a.code}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: a.category === 'MEDICAMENT_INTERNE' ? 'var(--primary-soft)' : a.category === 'CONSOMMABLE' ? 'var(--amber-soft, #fffbeb)' : 'var(--surface-2)',
                  color: a.category === 'MEDICAMENT_INTERNE' ? 'var(--primary)' : a.category === 'CONSOMMABLE' ? 'var(--amber, #d97706)' : 'var(--ink-2)',
                }}
              >
                {CATEGORY_LABEL[a.category]}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span>
                Qté :{' '}
                <strong style={{ color: a.currentQuantity <= a.minThreshold ? 'var(--danger)' : 'var(--ink)', fontSize: 14 }}>
                  {a.currentQuantity}
                </strong>{' '}
                {a.unit}
              </span>
              <span style={{ color: 'var(--ink-3)' }}>Seuil : {a.minThreshold}</span>
            </div>

            {a.category === 'MEDICAMENT_INTERNE' && a.nearestExpiry && (
              <div>
                <ExpiryBadge expiresOn={a.nearestExpiry} />
              </div>
            )}

            {a.supplierName && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.supplierName}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate(`/stock/articles/${a.id}`)}
                style={{
                  flex: 1,
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 550,
                  cursor: 'pointer',
                }}
              >
                Voir la fiche
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => { setEditArticle(a); setFormOpen(true); }}
                  aria-label={`Modifier ${a.label}`}
                  style={{
                    height: 36,
                    width: 36,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface)',
                    color: 'var(--ink-2)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✎
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingBottom: 16 }}>
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: '6px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface)',
                color: currentPage === 0 ? 'var(--ink-4, #ccc)' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ‹ Précédent
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', alignSelf: 'center' }}>
              {currentPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '6px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface)',
                color: currentPage >= totalPages - 1 ? 'var(--ink-4, #ccc)' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Suivant ›
            </button>
          </div>
        )}
      </div>

      {/* Form drawer */}
      <StockArticleFormDrawer
        mode={editArticle ? 'edit' : 'create'}
        article={editArticle}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </MScreen>
  );
}
