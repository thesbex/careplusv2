/**
 * ErrorBoundary — empêche un crash dans un composant de blanker toute la
 * page. Affiche un fallback lisible avec le message d'erreur et un bouton
 * "Recharger" plutôt qu'un écran blanc qui efface aussi le formulaire en
 * cours du médecin.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional extra context displayed in the fallback. */
  contextLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log côté console pour qu'on puisse diagnostiquer en prod via DevTools.
    // eslint-disable-next-line no-console
    console.error('[careplus] React tree crashed', error, info);
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 24,
            boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.12,
              color: 'var(--danger)',
              marginBottom: 8,
            }}
          >
            Erreur d'affichage
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
            careplus a rencontré un problème
          </h1>
          {this.props.contextLabel && (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 12px' }}>
              {this.props.contextLabel}
            </p>
          )}
          <pre
            style={{
              fontSize: 11.5,
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              background: 'var(--bg-alt, #f5f5f5)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 10,
              overflow: 'auto',
              maxHeight: 180,
              margin: '0 0 16px',
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {e.name}: {e.message}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid var(--primary)',
                background: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
