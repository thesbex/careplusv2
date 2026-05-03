/**
 * /stock — Liste des articles de stock (desktop).
 * Tableau paginé avec filtres toolbar.
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Edit, Eye, ChevronLeft, ChevronRight } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useStockArticles } from './hooks/useStockArticles';
import { useStockSuppliers } from './hooks/useStockSuppliers';
import { StockArticleFormDrawer } from './components/StockArticleFormDrawer';
import { CATEGORY_LABEL } from './types';
import type { StockArticle, StockArticleCategory } from './types';

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

const CATEGORIES: StockArticleCategory[] = [
  'MEDICAMENT_INTERNE',
  'DOSSIER_PHYSIQUE',
  'CONSOMMABLE',
];

function ExpiryPill({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return null;
  const today = new Date();
  const exp = new Date(expiresOn + 'T00:00:00');
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return null;

  const color = diffDays <= 7 ? 'var(--danger)' : 'var(--amber, #d97706)';
  const bg = diffDays <= 7 ? 'var(--danger-soft, #fef2f2)' : 'var(--amber-soft, #fffbeb)';

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 999,
        background: bg,
        color,
        marginLeft: 6,
        whiteSpace: 'nowrap',
      }}
    >
      Périme dans {diffDays}j
    </span>
  );
}

function CategoryPill({ category }: { category: StockArticleCategory }) {
  const colors: Record<StockArticleCategory, { bg: string; color: string }> = {
    MEDICAMENT_INTERNE: { bg: 'var(--primary-soft)', color: 'var(--primary)' },
    DOSSIER_PHYSIQUE: { bg: 'var(--surface-2)', color: 'var(--ink-2)' },
    CONSOMMABLE: { bg: 'var(--amber-soft, #fffbeb)', color: 'var(--amber, #d97706)' },
  };
  const { bg, color } = colors[category];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color,
      }}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} style={{ padding: '10px 12px' }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--border)',
                  width: j === 0 ? '40%' : j === 1 ? '70%' : '50%',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function StockArticlesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');

  // ── URL-synced filters ──────────────────────────────────────────────────
  const categoryParam = searchParams.get('category') ?? '';
  const supplierIdParam = searchParams.get('supplierId') ?? '';
  const belowThresholdParam = searchParams.get('belowThreshold') === 'true';
  const pageParam = parseInt(searchParams.get('page') ?? '0', 10);
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(searchParams.get('q') ?? '');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(qInput);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (qInput) next.set('q', qInput); else next.delete('q');
        next.set('page', '0');
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, setSearchParams]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        next.set('page', '0');
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const { articles, totalElements, totalPages, currentPage, isLoading, error } = useStockArticles({
    ...(categoryParam ? { category: categoryParam } : {}),
    ...(supplierIdParam ? { supplierId: supplierIdParam } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(belowThresholdParam ? { belowThreshold: true } : {}),
    page: pageParam,
    size: 20,
  });

  const { suppliers } = useStockSuppliers();

  // ── Drawer state ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<StockArticle | undefined>(undefined);

  function openCreate() {
    setEditArticle(undefined);
    setFormOpen(true);
  }

  function openEdit(a: StockArticle) {
    setEditArticle(a);
    setFormOpen(true);
  }

  return (
    <Screen
      active="stock"
      title="Stock interne"
      sub={`${totalElements} article${totalElements !== 1 ? 's' : ''}`}
      onNavigate={(id) => {
        const path = NAV_MAP[id as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus />
            Ajouter article
          </Button>
        ) : undefined
      }
    >
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filters toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Category chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setFilter('category', '')}
              style={{
                padding: '5px 12px',
                border: '1px solid var(--border)',
                borderRadius: 999,
                background: !categoryParam ? 'var(--primary)' : 'var(--surface)',
                color: !categoryParam ? 'white' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 550,
                cursor: 'pointer',
              }}
            >
              Tous
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter('category', categoryParam === cat ? '' : cat)}
                style={{
                  padding: '5px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  background: categoryParam === cat ? 'var(--primary)' : 'var(--surface)',
                  color: categoryParam === cat ? 'white' : 'var(--ink-2)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: 'pointer',
                }}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>

          {/* Supplier select */}
          <select
            value={supplierIdParam}
            onChange={(e) => setFilter('supplierId', e.target.value)}
            aria-label="Filtrer par fournisseur"
            style={{
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '0 8px',
              fontSize: 12.5,
              fontFamily: 'inherit',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <option value="">Tous fournisseurs</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Below threshold checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={belowThresholdParam}
              onChange={(e) => setFilter('belowThreshold', e.target.checked ? 'true' : '')}
            />
            Seuil dépassé uniquement
          </label>

          {/* Search */}
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Rechercher code / libellé…"
            aria-label="Recherche article"
            style={{
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '0 10px',
              fontSize: 12.5,
              fontFamily: 'inherit',
              background: 'var(--surface)',
              color: 'var(--ink)',
              marginLeft: 'auto',
              width: 220,
            }}
          />
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--danger-soft, #fef2f2)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--r-md)',
              fontSize: 13,
              color: 'var(--danger)',
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <Panel style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
              role="table"
              aria-label="Articles en stock"
            >
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Code', 'Libellé', 'Catégorie', 'Quantité', 'Seuil', 'Unité', 'Fournisseur'].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--ink-3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                  <th
                    scope="col"
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <SkeletonRows cols={8} />}
                {!isLoading && articles.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: '48px 16px',
                        textAlign: 'center',
                        color: 'var(--ink-3)',
                        fontSize: 13,
                      }}
                    >
                      Aucun article trouvé
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  articles.map((a) => (
                    <tr
                      key={a.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--ink-2)' }}>
                        {a.code}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 550 }}>
                        {a.label}
                        {a.category === 'MEDICAMENT_INTERNE' && (
                          <ExpiryPill expiresOn={a.nearestExpiry} />
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <CategoryPill category={a.category} />
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 650,
                          color: a.currentQuantity <= a.minThreshold ? 'var(--danger)' : 'var(--ink)',
                        }}
                      >
                        {a.currentQuantity}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-3)' }}>{a.minThreshold}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>{a.unit}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                        {a.supplierName ?? '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/stock/articles/${a.id}`)}
                            aria-label={`Voir ${a.label}`}
                          >
                            <Eye />
                            Voir
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(a)}
                              aria-label={`Modifier ${a.label}`}
                            >
                              <Edit />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft />
              Précédent
            </Button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Page {currentPage + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Page suivante"
            >
              Suivant
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      {/* Article form drawer */}
      <StockArticleFormDrawer
        mode={editArticle ? 'edit' : 'create'}
        article={editArticle}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </Screen>
  );
}
