/**
 * Landing page — `/`.
 * Page publique : hero, features, trust strip, CTA final, footer.
 * `Se connecter` redirige vers /login. Wrappé dans <GuestOnly /> côté router :
 * un utilisateur déjà authentifié arrive directement sur /agenda.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/ui/BrandMark';
import {
  Calendar,
  Users,
  Pill,
  Invoice,
  Lock,
  Check,
  Stetho,
  Clipboard,
} from '@/components/icons';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="lp-root">
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <Link to="/" className="lp-topbar-brand" aria-label="careplus — Accueil">
            <BrandMark size="md" />
            <span className="lp-topbar-name">careplus</span>
          </Link>
          <nav className="lp-topbar-nav" aria-label="Sections">
            <a href="#features">Fonctionnalités</a>
            <a href="#trust">Sécurité</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="lp-topbar-cta">
            <Link to="/login">
              <Button type="button" size="sm" variant="primary">
                <Lock /> Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="lp-hero" aria-labelledby="lp-hero-title">
        <div className="lp-hero-grid" aria-hidden="true" />
        <div className="lp-hero-inner">
          <div>
            <div className="lp-hero-eyebrow">Logiciel de cabinet médical · Maroc</div>
            <h1 id="lp-hero-title" className="lp-hero-title">
              La gestion de votre cabinet,
              <br />
              <span className="lp-hero-title-accent">simplement.</span>
            </h1>
            <p className="lp-hero-tagline">
              careplus accompagne les médecins généralistes marocains, de la prise de
              rendez-vous à l'édition des ordonnances et des factures conformes — en un seul
              outil, hébergé au Maroc.
            </p>

            <div className="lp-hero-ctas">
              <Link to="/login">
                <Button type="button" variant="primary" size="lg" style={{ height: 44 }}>
                  <Lock /> Se connecter
                </Button>
              </Link>
              <a href="#contact">
                <Button type="button" size="lg" style={{ height: 44 }}>
                  Demander une démo
                </Button>
              </a>
            </div>

            <div className="lp-hero-stats">
              <div>
                <div className="lp-hero-stat-v tnum">184</div>
                <div className="lp-hero-stat-k">Cabinets au Maroc</div>
              </div>
              <div>
                <div className="lp-hero-stat-v tnum">62k</div>
                <div className="lp-hero-stat-k">Consultations / mois</div>
              </div>
              <div>
                <div className="lp-hero-stat-v tnum">99,98%</div>
                <div className="lp-hero-stat-k">Disponibilité</div>
              </div>
            </div>
          </div>

          <aside className="lp-hero-illu" aria-hidden="true">
            <div className="lp-hero-illu-row">
              <div className="lp-hero-illu-ico"><Calendar /></div>
              <div>
                <div className="lp-hero-illu-pri">Mme Bennani — 09:30</div>
                <div className="lp-hero-illu-sub">Consultation suivi diabète</div>
              </div>
              <span className="lp-hero-illu-pill">Confirmé</span>
            </div>
            <div className="lp-hero-illu-row">
              <div className="lp-hero-illu-ico"><Stetho /></div>
              <div>
                <div className="lp-hero-illu-pri">M. El Idrissi — 10:00</div>
                <div className="lp-hero-illu-sub">Constantes prises · TA 138/82</div>
              </div>
              <span className="lp-hero-illu-pill">En cours</span>
            </div>
            <div className="lp-hero-illu-row">
              <div className="lp-hero-illu-ico"><Pill /></div>
              <div>
                <div className="lp-hero-illu-pri">Ordonnance générée</div>
                <div className="lp-hero-illu-sub">Augmentin 1g · Doliprane 1g</div>
              </div>
              <span className="lp-hero-illu-pill">PDF prêt</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="lp-section" id="features" aria-labelledby="lp-features-title">
        <div className="lp-section-eyebrow">Fonctionnalités</div>
        <h2 id="lp-features-title" className="lp-section-title">
          Tout ce qu'il faut pour faire tourner un cabinet, rien de plus.
        </h2>
        <p className="lp-section-sub">
          Pensé pour la médecine générale au Maroc : agenda partagé, dossier patient
          structuré, ordonnances et bons d'analyses, facturation conforme.
        </p>

        <div className="lp-features">
          <article className="lp-feature">
            <div className="lp-feature-ico"><Calendar /></div>
            <h3 className="lp-feature-title">Agenda intelligent</h3>
            <p className="lp-feature-body">
              Vue jour / semaine, créneaux récurrents, rappels SMS, salle d'attente
              avec prise de constantes par l'assistant.
            </p>
          </article>
          <article className="lp-feature">
            <div className="lp-feature-ico"><Users /></div>
            <h3 className="lp-feature-title">Dossier patient</h3>
            <p className="lp-feature-body">
              Antécédents, allergies, vaccins, documents historiques. Téléversement
              en consultation, accès rapide depuis l'agenda.
            </p>
          </article>
          <article className="lp-feature">
            <div className="lp-feature-ico"><Pill /></div>
            <h3 className="lp-feature-title">Ordonnances & bons</h3>
            <p className="lp-feature-body">
              Référentiel médicaments Maroc, contrôle d'allergies, bons d'analyses
              et d'imagerie. PDF prêts à imprimer ou envoyer.
            </p>
          </article>
          <article className="lp-feature">
            <div className="lp-feature-ico"><Invoice /></div>
            <h3 className="lp-feature-title">Facturation conforme</h3>
            <p className="lp-feature-body">
              Tarifs CNOPS / RAMED / privé, factures numérotées immutables,
              export comptabilité.
            </p>
          </article>
        </div>
      </section>

      <section className="lp-trust" id="trust" aria-label="Sécurité et conformité">
        <div className="lp-trust-inner">
          <div className="lp-trust-item">
            <span className="lp-trust-item-ico"><Lock /></span>
            <span>Hébergement au Maroc · OVH Casablanca</span>
          </div>
          <div className="lp-trust-item">
            <span className="lp-trust-item-ico"><Check /></span>
            <span>Conforme loi 09-08 (CNDP)</span>
          </div>
          <div className="lp-trust-item">
            <span className="lp-trust-item-ico"><Clipboard /></span>
            <span>Sauvegardes chiffrées quotidiennes</span>
          </div>
        </div>
      </section>

      <section className="lp-cta" id="contact" aria-labelledby="lp-cta-title">
        <div className="lp-cta-inner">
          <h2 id="lp-cta-title" className="lp-cta-title">
            Prêt à voir careplus en action ?
          </h2>
          <p className="lp-cta-sub">
            Connectez-vous à votre espace cabinet ou demandez une démo personnalisée.
          </p>
          <div className="lp-cta-row">
            <Link to="/login">
              <Button type="button" variant="primary" size="lg" style={{ height: 44 }}>
                <Lock /> Se connecter
              </Button>
            </Link>
            <a href="mailto:contact@careplus.ma">
              <Button type="button" size="lg" style={{ height: 44 }}>
                contact@careplus.ma
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-name">careplus SARL</span>
          <span className="lp-footer-sep">·</span>
          <span>© 2026 careplus</span>
          <span className="lp-footer-sep">·</span>
          <span>Casablanca, Maroc</span>
          <span className="lp-footer-sep">·</span>
          <span>RC 000000 — TVA 000000000</span>
        </div>
      </footer>
    </div>
  );
}
