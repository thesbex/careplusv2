import { useEffect, useRef, useState } from 'react';
import type { InvoiceSearchFilters } from './types';
import { useInvoiceExport } from './hooks/useInvoiceExport';

interface Props {
  filters: InvoiceSearchFilters;
}

/**
 * Split button: main action triggers CSV; the chevron opens a menu with CSV / xlsx.
 * Hidden via {@code data-export-allowed} (caller decides; usually MEDECIN/ADMIN only).
 */
export function ExportButton({ filters }: Props) {
  const { exportInvoices, isExporting, error, clearError } = useInvoiceExport();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <div className="fa-export-wrap" ref={menuRef}>
      <div className="fa-export-split">
        <button
          type="button"
          className="fa-export-main"
          disabled={isExporting}
          onClick={() => exportInvoices(filters, 'csv')}
        >
          {isExporting ? 'Préparation…' : 'Exporter'}
        </button>
        <button
          type="button"
          className="fa-export-caret"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Choisir le format d'export"
          disabled={isExporting}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ▾
        </button>
      </div>
      {menuOpen && (
        <div role="menu" className="fa-export-menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              exportInvoices(filters, 'csv');
            }}
          >
            Exporter en CSV (.csv)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              exportInvoices(filters, 'xlsx');
            }}
          >
            Exporter en Excel (.xlsx)
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="fa-export-error">
          {error}
          <button type="button" onClick={clearError} aria-label="Fermer">×</button>
        </div>
      )}
    </div>
  );
}
