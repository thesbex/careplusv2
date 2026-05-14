/**
 * Landing page — `/` (route publique).
 *
 * Port du design v2 (chat2) : deux variantes dédiées, switchées via
 * `useIsMobile()` — pas un fallback responsive d'un même DOM.
 *   - LandingDesktop : design-handoff-v2/careplus/project/Landing page.html
 *   - LandingMobile  : design-handoff-v2/careplus/project/Landing page - mobile.html
 *
 * Logo : SVG unique (gradient bleu C + cross), wordmark Plus Jakarta Sans
 * "care" + "plus" en deux tons.
 *
 * Auth : `Se connecter` → `/login`. Wrappé dans <GuestOnly /> côté router :
 * un utilisateur déjà authentifié arrive directement sur /agenda.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import './landing.css';

// ─────────── SVG icons (inline, scoped au prototype).
function LogoMark({ variant = 'gradient' }: { variant?: 'gradient' | 'flat-primary' | 'white' | 'soft' }) {
  // Le mark est rendu plusieurs fois (nav, footer, drawer, mockup app sidebar)
  // avec des id de gradient uniques pour éviter les collisions DOM.
  const idC = `lm-c-${variant}`;
  const idP = `lm-p-${variant}`;
  if (variant === 'flat-primary') {
    return (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M48 12 A24 24 0 1 0 48 52" stroke="#2A7CE7" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M30 21 h6 a2.2 2.2 0 0 1 2.2 2.2 V29 h5.8 a2.2 2.2 0 0 1 2.2 2.2 v3.6 a2.2 2.2 0 0 1 -2.2 2.2 H38.2 v5.8 a2.2 2.2 0 0 1 -2.2 2.2 h-6 a2.2 2.2 0 0 1 -2.2 -2.2 V37 h-5.8 a2.2 2.2 0 0 1 -2.2 -2.2 v-3.6 a2.2 2.2 0 0 1 2.2 -2.2 H27.8 V23.2 A2.2 2.2 0 0 1 30 21 Z" fill="#6CB6F6" />
      </svg>
    );
  }
  if (variant === 'white') {
    return (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M48 12 A24 24 0 1 0 48 52" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M30 21 h6 a2.2 2.2 0 0 1 2.2 2.2 V29 h5.8 a2.2 2.2 0 0 1 2.2 2.2 v3.6 a2.2 2.2 0 0 1 -2.2 2.2 H38.2 v5.8 a2.2 2.2 0 0 1 -2.2 2.2 h-6 a2.2 2.2 0 0 1 -2.2 -2.2 V37 h-5.8 a2.2 2.2 0 0 1 -2.2 -2.2 v-3.6 a2.2 2.2 0 0 1 2.2 -2.2 H27.8 V23.2 A2.2 2.2 0 0 1 30 21 Z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (variant === 'soft') {
    return (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M48 12 A24 24 0 1 0 48 52" stroke="#6CB6F6" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M30 21 h6 a2.2 2.2 0 0 1 2.2 2.2 V29 h5.8 a2.2 2.2 0 0 1 2.2 2.2 v3.6 a2.2 2.2 0 0 1 -2.2 2.2 H38.2 v5.8 a2.2 2.2 0 0 1 -2.2 2.2 h-6 a2.2 2.2 0 0 1 -2.2 -2.2 V37 h-5.8 a2.2 2.2 0 0 1 -2.2 -2.2 v-3.6 a2.2 2.2 0 0 1 2.2 -2.2 H27.8 V23.2 A2.2 2.2 0 0 1 30 21 Z" fill="#94CBF8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={idC} x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6CB6F6" />
          <stop offset="0.55" stopColor="#3A8FEB" />
          <stop offset="1" stopColor="#1B5BC7" />
        </linearGradient>
        <linearGradient id={idP} x1="32" y1="18" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#94CBF8" />
          <stop offset="1" stopColor="#2A7CE7" />
        </linearGradient>
      </defs>
      <path d="M48 12 A24 24 0 1 0 48 52" stroke={`url(#${idC})`} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M30 21 h6 a2.2 2.2 0 0 1 2.2 2.2 V29 h5.8 a2.2 2.2 0 0 1 2.2 2.2 v3.6 a2.2 2.2 0 0 1 -2.2 2.2 H38.2 v5.8 a2.2 2.2 0 0 1 -2.2 2.2 h-6 a2.2 2.2 0 0 1 -2.2 -2.2 V37 h-5.8 a2.2 2.2 0 0 1 -2.2 -2.2 v-3.6 a2.2 2.2 0 0 1 2.2 -2.2 H27.8 V23.2 A2.2 2.2 0 0 1 30 21 Z" fill={`url(#${idP})`} />
    </svg>
  );
}

const IconCalendar = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" /><path d="M5 2v3M11 2v3M2 6.5h12" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 2" />
  </svg>
);
const IconStetho = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v4.5c0 1.5 1.1 2.5 2.5 2.5S9 8 9 6.5V2" /><circle cx="11.5" cy="11" r="2" /><path d="M6.5 9v2c0 1.5 1.5 2.5 3 2.5" />
  </svg>
);
const IconInvoice = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1V2z" /><path d="M6 5h4M6 8h4M6 11h2" />
  </svg>
);
const IconBars = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 13V8M6 13V4M10 13V6M14 13V2" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5l3 3L13 4.5" />
  </svg>
);

// ────────── Données partagées entre les deux variantes
const FAQ_ITEMS = [
  {
    q: 'Mes données sont-elles hébergées au Maroc ?',
    a: 'Oui. Tous les serveurs careplus sont hébergés au Maroc, conformément à la loi 09-08 sur la protection des données personnelles. Vos dossiers patients ne quittent jamais le territoire.',
  },
  {
    q: "Puis-je essayer sans m'engager ?",
    a: "14 jours d'essai sans carte bancaire. Vous pouvez annuler en un clic depuis votre tableau de bord, à tout moment.",
  },
  {
    q: 'Comment migrer depuis mon logiciel actuel ?',
    a: 'Notre équipe importe vos patients, antécédents et historiques de RDV gratuitement. Compter 24 à 72 h selon le volume.',
  },
  {
    q: 'La facturation est-elle conforme à la loi 9-88 ?',
    a: 'Oui : ICE, mentions légales, TVA ou exonération, numérotation continue. Vos factures sont prêtes pour votre fiduciaire.',
  },
  {
    q: 'Combien de temps pour installer ?',
    a: '10 minutes pour créer votre compte et configurer votre agenda. Notre équipe est disponible par téléphone si besoin.',
  },
  {
    q: 'Puis-je utiliser careplus sur mobile ?',
    a: "Oui, careplus est entièrement responsive et fonctionne sur smartphone, tablette et ordinateur. Une app native iOS/Android est en cours de développement.",
  },
];

// ════════════════════════════════════════════════════════════════════════
// Wrapper
// ════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const isMobile = useIsMobile();
  return isMobile ? <LandingMobile /> : <LandingDesktop />;
}

// ════════════════════════════════════════════════════════════════════════
// Desktop
// ════════════════════════════════════════════════════════════════════════

function LandingDesktop() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  // Auto-close drawer on resize past 880px
  useEffect(() => {
    function onResize() { if (window.innerWidth > 880) setDrawerOpen(false); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="lp-root">
      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="careplus — Accueil">
            <span className="mark"><LogoMark variant="gradient" /></span>
            <span className="wm">care<span className="plus">plus</span></span>
          </Link>
          <div className="nav-links">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#ecrans">Interface</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#temoignages">Témoignages</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-cta">
            <Link to="/login" className="btn ghost desktop-only">Se connecter</Link>
            <a href="#cta" className="btn primary">Essai gratuit 14&nbsp;j</a>
            <button type="button" className="nav-burger" aria-label="Menu" onClick={() => setDrawerOpen((v) => !v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        <div className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
          <div className="container">
            <a href="#fonctionnalites" onClick={() => setDrawerOpen(false)}>Fonctionnalités</a>
            <a href="#ecrans" onClick={() => setDrawerOpen(false)}>Interface</a>
            <a href="#tarifs" onClick={() => setDrawerOpen(false)}>Tarifs</a>
            <a href="#temoignages" onClick={() => setDrawerOpen(false)}>Témoignages</a>
            <a href="#faq" onClick={() => setDrawerOpen(false)}>FAQ</a>
            <div className="drawer-actions">
              <Link to="/login" className="btn">Se connecter</Link>
              <a href="#cta" className="btn primary" onClick={() => setDrawerOpen(false)}>Démarrer mon essai gratuit</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-pill"><span className="d" />Hébergé au Maroc · conforme loi 09-08</span>
            <h1>La gestion de votre cabinet, <em>enfin simplement.</em></h1>
            <p className="hero-sub">Agenda, dossier patient, consultation, prescription et facturation conforme. Tout ce dont votre cabinet a besoin dans une seule suite, pensée pour la pratique médicale marocaine.</p>
            <div className="hero-cta">
              <a href="#cta" className="btn primary lg">Démarrer mon essai gratuit</a>
              <a href="#ecrans" className="btn lg">Voir l&apos;interface →</a>
            </div>
            <div className="hero-note">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3L13 4.5" /></svg>
              Sans carte bancaire · Installation en 10 minutes
            </div>
            <div className="hero-trust">
              <div><span className="n">184</span><span className="l">cabinets au Maroc</span></div>
              <div><span className="n">62k</span><span className="l">consultations / mois</span></div>
              <div><span className="n">99,98%</span><span className="l">disponibilité</span></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hv-app">
              <div className="hv-chrome">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span className="url">careplus.ma/agenda</span>
              </div>
              <div className="hv-body">
                <div className="hv-side">
                  <div className="b"><LogoMark variant="flat-primary" /></div>
                  <div className="ni on"><span className="ic" />Agenda</div>
                  <div className="ni"><span className="ic" />Patients</div>
                  <div className="ni"><span className="ic" />Salle</div>
                  <div className="ni"><span className="ic" />Consult.</div>
                  <div className="ni"><span className="ic" />Factures</div>
                </div>
                <div className="hv-main">
                  <div className="hv-top">
                    <span>Agenda semaine</span>
                    <span className="sub">· 20 — 25 avril</span>
                    <span className="search">Rechercher un patient…</span>
                  </div>
                  <div className="hv-grid">
                    <div className="h" /><div className="h">Lun 21</div><div className="h">Mar 22</div><div className="h">Mer 23</div><div className="h today">Jeu 24</div><div className="h">Ven 25</div>
                    <div>9h</div><div className="b ar">Alami · TA</div><div /><div className="b">Tahiri</div><div className="b ar">Cherkaoui</div><div className="b">Bouhlal</div>
                    <div>10h</div><div /><div className="b">Ziani · Suivi</div><div /><div className="b">Alaoui</div><div />
                    <div>11h</div><div className="b dn">Benkirane</div><div /><div className="b am">Lahlou · Urgent</div><div className="b">Tahiri · Diab.</div><div />
                    <div>14h</div><div className="b">Kettani</div><div /><div /><div className="b">Kettani</div><div className="b">Amrani</div>
                    <div>15h</div><div /><div className="b">Benkirane</div><div className="b am">Ziani</div><div /><div />
                    <div>16h</div><div className="b">Tazi</div><div /><div className="b">El Idrissi</div><div /><div className="b dn">Alami · Bilan</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hv-phone" aria-hidden="true">
              <div className="hv-phone-screen">
                <div className="ph-h"><span className="t">Jeudi 24</span><span className="s">6 RDV</span></div>
                <div className="ph-days">
                  <div className="d">L<span className="n">21</span></div>
                  <div className="d">M<span className="n">22</span></div>
                  <div className="d">M<span className="n">23</span></div>
                  <div className="d on">J<span className="n">24</span></div>
                  <div className="d">V<span className="n">25</span></div>
                </div>
                <div className="ph-rdv ar"><div className="t">09:00 · Arrivé</div><div className="n">Ahmed Cherkaoui</div><div className="r">Suivi HTA</div></div>
                <div className="ph-rdv"><div className="t">10:30 · 30 min</div><div className="n">Youness Alaoui</div><div className="r">Bilan sanguin</div></div>
                <div className="ph-rdv"><div className="t">11:15 · 15 min</div><div className="n">Khadija Tahiri</div><div className="r">Contrôle diabète</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="trust">
        <div className="container trust-inner">
          <span className="trust-label">Choisi par des cabinets de</span>
          <div className="trust-logos">
            <span className="trust-logo"><span className="mk">C</span>Casablanca</span>
            <span className="trust-logo"><span className="mk">R</span>Rabat</span>
            <span className="trust-logo"><span className="mk">M</span>Marrakech</span>
            <span className="trust-logo"><span className="mk">T</span>Tanger</span>
            <span className="trust-logo"><span className="mk">F</span>Fès</span>
            <span className="trust-logo"><span className="mk">A</span>Agadir</span>
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="flow" id="fonctionnalites">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow"><span className="d" />Tout le flux patient</span>
            <h2 className="sec-title">De l&apos;appel téléphonique à la facture payée</h2>
            <p className="sec-sub">Une seule plateforme pour votre secrétaire, votre assistante et vous. Chaque étape conçue pour la pratique médicale marocaine.</p>
          </div>
          <div className="flow-grid">
            <div className="flow-card"><span className="flow-num">01</span><div className="flow-ic"><IconCalendar /></div><div className="flow-h">Agenda intelligent</div><div className="flow-p">Vue semaine ou jour, créneaux configurables, prise de RDV en 3 clics. Vue mobile pour votre secrétaire en déplacement.</div></div>
            <div className="flow-card"><span className="flow-num">02</span><div className="flow-ic"><IconClock /></div><div className="flow-h">Salle d&apos;attente</div><div className="flow-p">Suivi en temps réel : qui est arrivé, qui passe ses constantes, qui est en consultation. Plus de « où en est ce patient ? ».</div></div>
            <div className="flow-card"><span className="flow-num">03</span><div className="flow-ic"><IconStetho /></div><div className="flow-h">Consultation SOAP</div><div className="flow-p">Notes structurées Subjectif / Objectif / Analyse / Plan. Allergies et antécédents toujours visibles. Historique en un clic.</div></div>
            <div className="flow-card"><span className="flow-num">04</span><div className="flow-ic"><IconInvoice /></div><div className="flow-h">Facturation conforme</div><div className="flow-p">Factures loi 9-88, ICE, mentions légales, TVA ou exonération. Suivi des impayés et relances automatisées.</div></div>
          </div>
        </div>
      </section>

      {/* Mosaic */}
      <section className="mosaic" id="ecrans">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow"><span className="d" />L&apos;interface en détail</span>
            <h2 className="sec-title">Conçue par des médecins, pour des médecins</h2>
            <p className="sec-sub">Dense quand il le faut, respirante où il le faut. Typographie utilitaire, hiérarchie claire, aucune place pour l&apos;ambiguïté.</p>
          </div>
          <div className="mosaic-grid">
            <div className="mc lg">
              <div className="ma">
                <div className="h" /><div className="h">Lun 21</div><div className="h">Mar 22</div><div className="h today">Jeu 24</div><div className="h">Ven 25</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>9h</div><div className="b ar">09:00 Cherkaoui</div><div /><div className="b ar">09:00 Alami</div><div className="b">09:15 Bouhlal</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>10h</div><div /><div className="b">10:00 Ziani</div><div className="b">10:30 Alaoui</div><div />
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>11h</div><div className="b">11:00 Tazi</div><div /><div className="b am">11:15 Tahiri</div><div className="b">11:00 Amrani</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>14h</div><div className="b">14:00 Kettani</div><div /><div className="b">14:00 Kettani</div><div className="b">14:30 El Idrissi</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>15h</div><div /><div className="b am">15:00 Ziani</div><div className="b">15:00 Benkirane</div><div />
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>16h</div><div className="b">16:00 Tazi</div><div /><div /><div className="b">16:30 Alami · Bilan</div>
              </div>
              <span className="mc-label"><span className="kb">01</span>Agenda semaine</span>
            </div>

            <div className="mc md">
              <div className="salle">
                <div className="hd">Salle d&apos;attente · 4</div>
                <div className="row"><div className="av">MA</div><div className="nm">Mohamed Alami</div><div className="pl c">Consult.</div></div>
                <div className="row"><div className="av" style={{ background: '#F1E1A5', color: '#7A5B10' }}>YZ</div><div className="nm">Youssef Ziani</div><div className="pl w">Constantes</div></div>
                <div className="row"><div className="av" style={{ background: '#C7DCEE', color: '#1C4B75' }}>AC</div><div className="nm">Ahmed Cherkaoui</div><div className="pl a">Arrivé</div></div>
                <div className="row"><div className="av">KT</div><div className="nm">Khadija Tahiri</div><div className="pl w">Attend</div></div>
              </div>
              <span className="mc-label"><span className="kb">04</span>Salle d&apos;attente</span>
            </div>

            <div className="mc sm">
              <div className="vit">
                <div className="c"><div className="k">TA</div><div className="v">135/85<span>mmHg</span></div></div>
                <div className="c"><div className="k">FC</div><div className="v">82<span>bpm</span></div></div>
                <div className="c"><div className="k">T°</div><div className="v">36,8<span>°C</span></div></div>
                <div className="c"><div className="k">SpO₂</div><div className="v">98<span>%</span></div></div>
              </div>
              <span className="mc-label"><span className="kb">05</span>Constantes</span>
            </div>

            <div className="mc sm">
              <div className="fac">
                <div className="row"><span className="n">Mohamed Alami</span><span className="a">300</span><span className="s p">Payée</span></div>
                <div className="row"><span className="n">Fatima Lahlou</span><span className="a">250</span><span className="s w">Attente</span></div>
                <div className="row"><span className="n">Youssef Ziani</span><span className="a">450</span><span className="s p">Payée</span></div>
                <div className="row"><span className="n">Khadija Tahiri</span><span className="a">300</span><span className="s o">Retard</span></div>
              </div>
              <span className="mc-label"><span className="kb">09</span>Facturation</span>
            </div>

            <div className="mc md">
              <div className="rx">
                <div className="h"><span className="name">Dr. K. El Amrani</span></div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 4 }}>Mohamed Alami · 58 ans</div>
                <div className="ttl">Ordonnance</div>
                <div className="line"><div className="t">Amlodipine 5 mg</div><div className="d">1 cp matin · 30 j</div></div>
                <div className="line"><div className="t">Atorvastatine 20 mg</div><div className="d">1 cp soir · 30 j</div></div>
                <div className="line"><div className="t">Aspirine 100 mg</div><div className="d">1 cp midi · 30 j</div></div>
              </div>
              <span className="mc-label"><span className="kb">08</span>Ordonnance A4</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature blocks */}
      <section className="feat">
        <div className="container">

          <div className="feat-row">
            <div>
              <div className="feat-kicker"><IconCalendar />Agenda</div>
              <h3>Un agenda que votre secrétaire adopte en 10 minutes</h3>
              <p>Tous les rendez-vous, toutes les salles, tous les praticiens en une vue. Créneaux de 15 à 45 minutes, glisser-déposer pour replanifier, codes couleur par statut.</p>
              <ul>
                <li><span className="ck"><IconCheck /></span><span><strong>Multi-praticiens</strong> · chaque médecin son agenda, consultables côte à côte</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>SMS de rappel</strong> automatiques la veille, en français ou en arabe</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Horaires personnalisables</strong> par jour, pauses et jours fériés</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Vue mobile</strong> pour la secrétaire en déplacement</span></li>
              </ul>
            </div>
            <div className="feat-vis">
              <div className="fv-ag">
                <div className="h"><span className="t">Agenda semaine</span><span className="s">20 — 25 avril 2026</span></div>
                <div className="g">
                  <div className="hr">H</div><div className="dh">Lun<span className="num">21</span></div><div className="dh">Mar<span className="num">22</span></div><div className="dh">Mer<span className="num">23</span></div><div className="dh today">Jeu<span className="num">24</span></div><div className="dh">Ven<span className="num">25</span></div>
                  <div className="hr">9h</div><div className="b ar">09:00 Cherkaoui</div><div /><div className="b">09:15 Bouhlal</div><div className="b ar">09:00 Alami</div><div className="b">09:30 Tahiri</div>
                  <div className="hr">10h</div><div /><div className="b">10:00 Ziani</div><div className="b">10:30 Alaoui</div><div className="b">10:15 Amrani</div><div />
                  <div className="hr">11h</div><div className="b">11:00 Tazi</div><div className="b am">11:15 Urgent</div><div /><div className="b">11:00 Kettani</div><div className="b">11:30 Bouhlal</div>
                </div>
              </div>
            </div>
          </div>

          <div className="feat-row rev">
            <div>
              <div className="feat-kicker"><IconStetho />Consultation</div>
              <h3>La consultation, structurée et sans friction</h3>
              <p>Notes SOAP, antécédents et allergies en haut de page, prescription en deux clics. Tout ce qui se passe pendant la consultation reste à portée de regard.</p>
              <ul>
                <li><span className="ck"><IconCheck /></span><span><strong>Modèles de consultation</strong> par spécialité — médecine générale, cardio, gynéco, pédiatrie</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Prescriptions</strong> avec base médicaments et alertes interactions</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Ordonnances A4</strong> mises en page automatiquement, signature scannée</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Historique unifié</strong> consultation, biologie, imagerie</span></li>
              </ul>
            </div>
            <div className="feat-vis">
              <div className="fv-so">
                <div className="ctx">
                  <div className="av">MA</div>
                  <div>
                    <div className="nm">Mohamed Alami</div>
                    <div className="mt">58 ans · HTA, diabète T2</div>
                  </div>
                  <div className="al">⚠ Pénicilline</div>
                </div>
                <div className="sec"><div className="sec-h"><div className="lt">S</div><div className="tl">Subjectif</div></div><div className="bd">Patient revient pour son contrôle trimestriel. Pas de douleur thoracique. Tolérance correcte du traitement.</div></div>
                <div className="sec"><div className="sec-h"><div className="lt">O</div><div className="tl">Objectif</div></div><div className="bd">TA 135/85 · FC 82 · Glycémie cap. 1,38 g/L · Auscultation cardio-pulmonaire normale.</div></div>
                <div className="sec"><div className="sec-h"><div className="lt">A</div><div className="tl">Analyse</div></div><div className="bd">HTA équilibrée. Diabète T2 contrôlé. Poursuite traitement actuel.</div></div>
              </div>
            </div>
          </div>

          <div className="feat-row">
            <div>
              <div className="feat-kicker"><IconBars />Pilotage</div>
              <h3>Pilotez votre cabinet, pas seulement vos patients</h3>
              <p>Tableau de bord clair pour comprendre votre activité : volume de consultations, mix payeurs, suivi des impayés, taux de no-show.</p>
              <ul>
                <li><span className="ck"><IconCheck /></span><span><strong>KPIs hebdomadaires</strong> envoyés par email tous les lundis matin</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Suivi des impayés</strong> et relances automatiques</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Export comptable</strong> au format de votre fiduciaire</span></li>
                <li><span className="ck"><IconCheck /></span><span><strong>Mode multi-cabinets</strong> pour les groupes médicaux</span></li>
              </ul>
            </div>
            <div className="feat-vis">
              <div className="fv-st">
                <div className="h"><span className="ttl">Activité du cabinet</span><span className="sub">avril 2026</span></div>
                <div className="kpis">
                  <div className="kpi"><div className="k">Consultations</div><div className="v">348<span>+12%</span></div></div>
                  <div className="kpi"><div className="k">CA HT</div><div className="v">98,4<span>k DH</span></div></div>
                  <div className="kpi"><div className="k">No-show</div><div className="v">3,8<span>%</span></div></div>
                </div>
                <div className="chart">
                  <div className="chart-h"><span className="chart-t">Consultations par jour</span><span className="chart-l">avril</span></div>
                  <div className="bars">
                    <div className="bar" style={{ height: '40%' }}><span className="bar-lbl">L</span></div>
                    <div className="bar" style={{ height: '62%' }}><span className="bar-lbl">M</span></div>
                    <div className="bar" style={{ height: '55%' }}><span className="bar-lbl">M</span></div>
                    <div className="bar" style={{ height: '78%' }}><span className="bar-lbl">J</span></div>
                    <div className="bar" style={{ height: '82%' }}><span className="bar-lbl">V</span></div>
                    <div className="bar a" style={{ height: '30%' }}><span className="bar-lbl">S</span></div>
                    <div className="bar a" style={{ height: '8%' }}><span className="bar-lbl">D</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Pricing */}
      <section className="pricing" id="tarifs">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow"><span className="d" />Tarifs</span>
            <h2 className="sec-title">Sans engagement, sans surprise</h2>
            <p className="sec-sub">Essai 14 jours offert sur tous les plans. Annulation en un clic depuis votre tableau de bord.</p>
          </div>
          <div className="pricing-grid">
            <div className="price">
              <div className="name">Solo</div>
              <div className="desc">Pour le médecin qui débute son cabinet.</div>
              <div className="amt"><span className="n">290</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
              <ul>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Agenda et dossier patient</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Consultation SOAP</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Ordonnances et certificats</li>
                <li className="muted"><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Multi-utilisateurs</li>
                <li className="muted"><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Facturation conforme</li>
              </ul>
              <a href="#cta" className="btn">Choisir Solo</a>
            </div>

            <div className="price featured">
              <span className="price-tag">Le plus choisi</span>
              <div className="name">Cabinet</div>
              <div className="desc">Pour le cabinet avec secrétaire et assistante.</div>
              <div className="amt"><span className="n">490</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
              <ul>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Tout le plan Solo</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Multi-utilisateurs (3 inclus)</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Salle d&apos;attente temps réel</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Facturation loi 9-88, ICE</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>SMS de rappel inclus</li>
              </ul>
              <a href="#cta" className="btn primary">Démarrer l&apos;essai</a>
            </div>

            <div className="price">
              <div className="name">Multi-cabinets</div>
              <div className="desc">Pour les groupes médicaux et polycliniques.</div>
              <div className="amt"><span className="n">990</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
              <ul>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Tout le plan Cabinet</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Utilisateurs illimités</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Sites multiples</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>API et intégrations</li>
                <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Account manager dédié</li>
              </ul>
              <a href="#cta" className="btn">Nous contacter</a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testi" id="temoignages">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow"><span className="d" />Témoignages</span>
            <h2 className="sec-title">Ce qu&apos;en disent nos médecins</h2>
          </div>
          <div className="testi-grid">
            <div className="quote">
              <p className="q">On a divisé par deux le temps de la secrétaire en fin de journée. Les patients arrivent, on sait où ils en sont, et la facture sort en un clic. Pour un cabinet de cardio, c&apos;est un changement complet.</p>
              <div className="who">
                <div className="av">KE</div>
                <div>
                  <div className="nm">Dr. Khalid El Amrani</div>
                  <div className="ti">Cardiologue · Casablanca</div>
                </div>
              </div>
            </div>
            <div className="quote-side">
              <div className="qs">
                <p className="qt">L&apos;agenda mobile a changé notre quotidien. Ma secrétaire prend les RDV depuis son téléphone, depuis chez elle si besoin.</p>
                <div className="who"><div className="av">SH</div><div><div className="nm">Dr. Sofia Haddad</div><div className="ti">Pédiatre · Rabat</div></div></div>
              </div>
              <div className="qs">
                <p className="qt">Les factures conformes loi 9-88 m&apos;ont fait gagner des heures avec mon comptable. Tout est prêt, propre, exportable.</p>
                <div className="who"><div className="av">YB</div><div><div className="nm">Dr. Younes Bennani</div><div className="ti">Médecine générale · Marrakech</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div className="container faq-grid">
          <div>
            <span className="sec-eyebrow"><span className="d" />FAQ</span>
            <h2 className="sec-title" style={{ textAlign: 'left', fontSize: 36 }}>Questions fréquentes</h2>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-3)', margin: '14px 0 0', maxWidth: 340 }}>Une question qui n&apos;est pas listée ? Notre équipe est joignable du lundi au vendredi, 9h–19h.</p>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`faq-item${faqOpen === i ? ' open' : ''}`}>
                <button type="button" className="faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  {item.q}
                  <span className="pl" aria-hidden="true">+</span>
                </button>
                <div className="faq-a">
                  <div className="faq-a-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final" id="cta">
        <div className="container final-inner">
          <h2>Prêt à simplifier votre cabinet&nbsp;?</h2>
          <p>Essai 14 jours · Sans carte bancaire · Installation en 10 minutes. Notre équipe vous accompagne à chaque étape.</p>
          <div className="final-actions">
            <Link to="/login" className="btn lg">Démarrer mon essai gratuit</Link>
            <a href="tel:+212522000000" className="btn ghost lg">Parler à un conseiller</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="foot">
        <div className="container">
          <div className="foot-grid">
            <div className="foot-brand">
              <Link to="/" className="brand">
                <span className="mark"><LogoMark variant="white" /></span>
                <span className="wm">care<span className="plus">plus</span></span>
              </Link>
              <p>La suite logicielle qui permet aux cabinets médicaux marocains de se concentrer sur leurs patients.</p>
              <p className="foot-legal">careplus SARL · Casablanca, Maroc<br />ICE 002847163000091 · RC 547821</p>
            </div>
            <div>
              <h4>Produit</h4>
              <ul>
                <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                <li><a href="#ecrans">Interface</a></li>
                <li><a href="#tarifs">Tarifs</a></li>
                <li><a href="#temoignages">Témoignages</a></li>
              </ul>
            </div>
            <div>
              <h4>Société</h4>
              <ul>
                <li><a href="#">À propos</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Carrières</a></li>
                <li><a href="#">Presse</a></li>
              </ul>
            </div>
            <div>
              <h4>Ressources</h4>
              <ul>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Centre d&apos;aide</a></li>
                <li><a href="#">Loi 09-08</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 careplus SARL · Tous droits réservés.</span>
            <span>Hébergement conforme loi 09-08 · ANRT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Mobile
// ════════════════════════════════════════════════════════════════════════

function LandingMobile() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Carousel scroll → active dot
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function onScroll() {
      if (!rail) return;
      const child = rail.children[0] as HTMLElement | undefined;
      if (!child) return;
      const idx = Math.round(rail.scrollLeft / (child.offsetWidth + 12));
      setCarouselIdx(idx);
    }
    rail.addEventListener('scroll', onScroll, { passive: true });
    return () => rail.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="m-lp-root">
      {/* Top nav */}
      <header className="m-nav">
        <Link to="/" className="m-brand" aria-label="careplus — Accueil">
          <span className="mark"><LogoMark variant="gradient" /></span>
          <span className="wm">care<span className="plus">plus</span></span>
        </Link>
        <span className="spacer" />
        <Link to="/login" className="login">Connexion</Link>
        <button type="button" className="m-burger" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </header>

      {/* Drawer */}
      <div className={`m-drawer${drawerOpen ? ' open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
        <div className="m-drawer-sheet">
          <div className="m-drawer-head">
            <button type="button" className="m-drawer-close" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav>
            <a href="#fonctionnalites" onClick={() => setDrawerOpen(false)}>Fonctionnalités</a>
            <a href="#ecrans" onClick={() => setDrawerOpen(false)}>Interface</a>
            <a href="#tarifs" onClick={() => setDrawerOpen(false)}>Tarifs</a>
            <a href="#temoignages" onClick={() => setDrawerOpen(false)}>Témoignages</a>
            <a href="#faq" onClick={() => setDrawerOpen(false)}>FAQ</a>
            <Link to="/login" onClick={() => setDrawerOpen(false)}>Se connecter</Link>
          </nav>
          <div className="drawer-cta">
            <a href="#cta" className="m-btn primary" onClick={() => setDrawerOpen(false)}>Démarrer mon essai gratuit</a>
            <a href="tel:+212522000000" className="m-btn ghost">Parler à un conseiller</a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="m-hero">
        <span className="m-pill"><span className="d" />Hébergé au Maroc · loi 09-08</span>
        <h1>La gestion de votre cabinet, <em>enfin simplement.</em></h1>
        <p className="lead">Agenda, dossier patient, consultation et facturation conforme. Tout en une seule app, pensée pour la pratique médicale marocaine.</p>
        <div className="cta-row">
          <a href="#cta" className="m-btn primary">Démarrer mon essai gratuit</a>
          <a href="#ecrans" className="m-btn">Voir l&apos;interface</a>
        </div>
        <div className="m-hero-note">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3L13 4.5" /></svg>
          Sans carte bancaire · Installation en 10 minutes
        </div>

        <div className="m-hero-phone">
          <div className="m-phone">
            <div className="m-phone-screen">
              <div className="ps-h"><span className="t">Jeudi 24 avril</span><span className="s">6 RDV</span></div>
              <div className="ps-days">
                <div className="d">L<span className="n">21</span></div>
                <div className="d">M<span className="n">22</span></div>
                <div className="d">M<span className="n">23</span></div>
                <div className="d on">J<span className="n">24</span></div>
                <div className="d">V<span className="n">25</span></div>
              </div>
              <div className="ps-rdv arr"><div className="t">09:00 · Arrivé</div><div className="n">Ahmed Cherkaoui</div><div className="r">Suivi HTA · 20 min</div></div>
              <div className="ps-rdv"><div className="t">10:30 · 30 min</div><div className="n">Youness Alaoui</div><div className="r">Bilan sanguin</div></div>
              <div className="ps-rdv urg"><div className="t">11:15 · Urgent</div><div className="n">Khadija Tahiri</div><div className="r">Contrôle diabète</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <div className="m-trust">
        <div className="stat"><div className="n">184</div><div className="l">cabinets au Maroc</div></div>
        <div className="stat"><div className="n">62k</div><div className="l">consults / mois</div></div>
        <div className="stat"><div className="n">99,98%</div><div className="l">disponibilité</div></div>
      </div>

      {/* Flow */}
      <section className="m-flow" id="fonctionnalites">
        <span className="sec-eyebrow"><span className="d" />Tout le flux patient</span>
        <h2 className="sec-title">De l&apos;appel téléphonique à la facture payée</h2>
        <p className="sec-sub">Une seule app pour votre secrétaire, votre assistante et vous.</p>

        <div className="m-flow-list">
          <div className="m-flow-card"><div className="ic"><IconCalendar /></div><div><div className="num">01</div><h3>Agenda intelligent</h3><p>Vue jour ou semaine, créneaux configurables, prise de RDV en 3 taps. Vue mobile native pour votre secrétaire.</p></div></div>
          <div className="m-flow-card"><div className="ic"><IconClock /></div><div><div className="num">02</div><h3>Salle d&apos;attente</h3><p>Suivi temps réel : qui est arrivé, qui passe ses constantes, qui est en consultation. Plus jamais perdu.</p></div></div>
          <div className="m-flow-card"><div className="ic"><IconStetho /></div><div><div className="num">03</div><h3>Consultation SOAP</h3><p>Notes structurées Subjectif/Objectif/Analyse/Plan. Allergies et antécédents toujours visibles en un tap.</p></div></div>
          <div className="m-flow-card"><div className="ic"><IconInvoice /></div><div><div className="num">04</div><h3>Facturation conforme</h3><p>Factures loi 9-88, ICE, mentions légales, TVA ou exonération. Suivi des impayés et relances automatisées.</p></div></div>
        </div>
      </section>

      {/* Screens carousel */}
      <section className="m-screens" id="ecrans">
        <div className="sec-head">
          <span className="sec-eyebrow"><span className="d" />L&apos;interface en détail</span>
          <h2 className="sec-title">Conçue par des médecins, pour des médecins</h2>
          <p className="sec-sub">Glissez pour voir chaque écran.</p>
        </div>

        <div className="m-screens-rail" ref={railRef}>
          <div className="m-screen">
            <div className="m-screen-body scr-salle">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Salle d&apos;attente · 4</div>
              <div className="row"><div className="av">MA</div><div className="nm">Mohamed Alami</div><div className="pl c">Consult.</div></div>
              <div className="row"><div className="av" style={{ background: '#F1E1A5', color: '#7A5B10' }}>YZ</div><div className="nm">Youssef Ziani</div><div className="pl w">Constantes</div></div>
              <div className="row"><div className="av" style={{ background: '#C7DCEE', color: '#1C4B75' }}>AC</div><div className="nm">Ahmed Cherkaoui</div><div className="pl a">Arrivé</div></div>
              <div className="row"><div className="av">KT</div><div className="nm">Khadija Tahiri</div><div className="pl w">Attend</div></div>
            </div>
            <div className="m-screen-foot"><span className="kb">04</span><span className="lbl">Salle d&apos;attente</span></div>
          </div>

          <div className="m-screen">
            <div className="m-screen-body scr-vit">
              <div className="c"><div className="k">TA</div><div className="v">135/85<span>mmHg</span></div></div>
              <div className="c"><div className="k">FC</div><div className="v">82<span>bpm</span></div></div>
              <div className="c"><div className="k">T°</div><div className="v">36,8<span>°C</span></div></div>
              <div className="c"><div className="k">SpO₂</div><div className="v">98<span>%</span></div></div>
              <div className="c" style={{ gridColumn: 'span 2' }}><div className="k">Poids · IMC</div><div className="v" style={{ fontSize: 18 }}>76 kg<span> · 24,8</span></div></div>
            </div>
            <div className="m-screen-foot"><span className="kb">05</span><span className="lbl">Constantes</span></div>
          </div>

          <div className="m-screen">
            <div className="m-screen-body scr-rx">
              <div className="h"><span className="name">Dr. K. El Amrani</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 2 }}>Mohamed Alami · 58 ans</div>
              <div className="ttl">Ordonnance</div>
              <div className="ln"><div className="t">Amlodipine 5 mg</div><div className="d">1 cp matin · 30 j</div></div>
              <div className="ln"><div className="t">Atorvastatine 20 mg</div><div className="d">1 cp soir · 30 j</div></div>
              <div className="ln"><div className="t">Aspirine 100 mg</div><div className="d">1 cp midi · 30 j</div></div>
            </div>
            <div className="m-screen-foot"><span className="kb">08</span><span className="lbl">Ordonnance A4</span></div>
          </div>

          <div className="m-screen">
            <div className="m-screen-body scr-fac">
              <div className="row"><span className="n">Mohamed Alami</span><span className="a">300</span><span className="s p">Payée</span></div>
              <div className="row"><span className="n">Fatima Lahlou</span><span className="a">250</span><span className="s w">Attente</span></div>
              <div className="row"><span className="n">Youssef Ziani</span><span className="a">450</span><span className="s p">Payée</span></div>
              <div className="row"><span className="n">Khadija Tahiri</span><span className="a">300</span><span className="s o">Retard</span></div>
              <div className="row"><span className="n">Ahmed Cherkaoui</span><span className="a">350</span><span className="s p">Payée</span></div>
            </div>
            <div className="m-screen-foot"><span className="kb">09</span><span className="lbl">Facturation</span></div>
          </div>
        </div>

        <div className="m-screens-dots">
          {[0, 1, 2, 3].map((i) => <span key={i} className={i === carouselIdx ? 'on' : ''} />)}
        </div>
      </section>

      {/* Pricing */}
      <section className="m-pricing" id="tarifs">
        <span className="sec-eyebrow"><span className="d" />Tarifs</span>
        <h2 className="sec-title">Sans engagement, sans surprise</h2>
        <p className="sec-sub">Essai 14 jours offert. Annulation en un clic.</p>

        <div className="m-price-list">
          <div className="m-price">
            <div className="name">Solo</div>
            <div className="desc">Pour le médecin qui débute son cabinet.</div>
            <div className="amt"><span className="n">290</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
            <ul>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Agenda et dossier patient</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Consultation SOAP</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Ordonnances et certificats</li>
              <li className="muted"><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Facturation conforme</li>
            </ul>
            <a href="#cta" className="m-btn">Choisir Solo</a>
          </div>

          <div className="m-price featured">
            <span className="m-price-tag">Le plus choisi</span>
            <div className="name">Cabinet</div>
            <div className="desc">Pour le cabinet avec secrétaire et assistante.</div>
            <div className="amt"><span className="n">490</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
            <ul>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Tout le plan Solo</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Multi-utilisateurs (3 inclus)</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Salle d&apos;attente temps réel</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Facturation loi 9-88, ICE</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>SMS de rappel inclus</li>
            </ul>
            <a href="#cta" className="m-btn primary">Démarrer l&apos;essai</a>
          </div>

          <div className="m-price">
            <div className="name">Multi-cabinets</div>
            <div className="desc">Pour les groupes médicaux et polycliniques.</div>
            <div className="amt"><span className="n">990</span><span className="u">DH</span><span className="per">/ mois HT</span></div>
            <ul>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Tout le plan Cabinet</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Utilisateurs illimités</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Sites multiples</li>
              <li><svg className="ck" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 8.5l3 3L13 4.5" /></svg>Account manager dédié</li>
            </ul>
            <a href="#cta" className="m-btn">Nous contacter</a>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="m-test" id="temoignages">
        <span className="sec-eyebrow"><span className="d" />Témoignages</span>
        <h2 className="sec-title">Ce qu&apos;en disent nos médecins</h2>
        <div className="m-test-card">
          <p className="q">On a divisé par deux le temps de la secrétaire en fin de journée. Les patients arrivent, on sait où ils en sont, et la facture sort en un clic.</p>
          <div className="who">
            <div className="av">KE</div>
            <div>
              <div className="nm">Dr. Khalid El Amrani</div>
              <div className="ti">Cardiologue · Casablanca</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="m-faq" id="faq">
        <span className="sec-eyebrow"><span className="d" />Questions fréquentes</span>
        <h2 className="sec-title">On répond à tout</h2>

        <div className="m-faq-list">
          {FAQ_ITEMS.slice(0, 5).map((item, i) => (
            <div key={i} className={`m-faq-item${faqOpen === i ? ' open' : ''}`}>
              <button type="button" className="m-faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                {item.q}
                <span className="plus" aria-hidden="true">+</span>
              </button>
              <div className="m-faq-a">
                <div className="m-faq-a-inner">{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <div className="m-final" id="cta">
        <h2>Prêt à simplifier votre cabinet ?</h2>
        <p>Essai 14 jours · Sans carte · Installation en 10 minutes.</p>
        <Link to="/login" className="m-btn">Démarrer mon essai gratuit</Link>
      </div>

      {/* Footer */}
      <footer className="m-foot">
        <Link to="/" className="m-brand">
          <span className="mark"><LogoMark variant="soft" /></span>
          <span className="wm">care<span className="plus">plus</span></span>
        </Link>
        <p className="tag">La suite logicielle qui permet aux cabinets médicaux marocains de se concentrer sur leurs patients.</p>

        <div className="m-foot-grid">
          <div>
            <h4>Produit</h4>
            <ul>
              <li><a href="#fonctionnalites">Fonctionnalités</a></li>
              <li><a href="#ecrans">Interface</a></li>
              <li><a href="#tarifs">Tarifs</a></li>
            </ul>
          </div>
          <div>
            <h4>Société</h4>
            <ul>
              <li><a href="#">À propos</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Carrières</a></li>
            </ul>
          </div>
          <div>
            <h4>Ressources</h4>
            <ul>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Aide</a></li>
            </ul>
          </div>
          <div>
            <h4>Légal</h4>
            <ul>
              <li><a href="#">Confidentialité</a></li>
              <li><a href="#">CGU</a></li>
              <li><a href="#">Loi 09-08</a></li>
            </ul>
          </div>
        </div>

        <div className="legal">
          © 2026 careplus SARL · Casablanca, Maroc · ICE 002847163000091<br />
          Hébergement conforme loi 09-08
        </div>
      </footer>

      {/* Sticky bottom CTA */}
      <div className="m-cta-bar">
        <div className="price-hint">À partir de<b>290 DH/mois</b></div>
        <a href="#cta" className="m-btn primary">Essai gratuit</a>
      </div>
    </div>
  );
}
