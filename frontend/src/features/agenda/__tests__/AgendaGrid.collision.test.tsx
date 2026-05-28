/**
 * AgendaGrid — IT « bouteille » de la walk manual-QA du 2026-05-28.
 *
 * Couvre les invariants visuels qu'on a verrouillés au navigateur après le
 * seed multi-statuts/multi-docteurs (cf. agenda-grid-v3.png) :
 *  - Side-by-side : deux RDV qui se chevauchent obtiennent left/width
 *    distincts (pas d'empilement vertical).
 *  - « En retard » : un PLANIFIE (status='confirmed') aujourd'hui dont le
 *    créneau a dépassé +5 min sans arrivée porte la classe `ag-late` + un
 *    aria-label suffixé « (en retard) ».
 *  - « Terminé » : un CLOS (status='done') porte la classe `ag-done` et un
 *    bord gris (#9B9B9B, iso maquette) — pas vert.
 *  - « En cours » : un EN_CONSULTATION porte la classe `ag-consult` (saphir
 *    plein + texte blanc — verrouillé via la classe, la couleur RGB exacte
 *    vit en CSS et ne se teste pas en JSdom sans rendre la feuille).
 *
 * On rend AgendaGrid directement avec des fixtures de la main pour éviter
 * de re-mocker tous les hooks de la page (auth/queue/practitioners…).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AgendaGrid } from '../components/AgendaGrid';
import type { Appointment, WeekDay } from '../types';

const DAYS: WeekDay[] = [
  { key: 'lun', label: 'Lundi', date: '25' },
  { key: 'mar', label: 'Mardi', date: '26' },
  { key: 'mer', label: 'Mercredi', date: '27' },
  { key: 'jeu', label: 'Jeudi', date: '28' },
  { key: 'ven', label: 'Vendredi', date: '29' },
  { key: 'sam', label: 'Samedi', date: '30' },
];

function appt(o: Partial<Appointment> & Pick<Appointment, 'day' | 'start' | 'dur' | 'patient' | 'reason' | 'status'>): Appointment {
  return { ...o };
}

describe('AgendaGrid — collision + late + status invariants', () => {
  it('overlapping appointments render side-by-side (distinct left/width inline styles)', () => {
    const overlap: Appointment[] = [
      appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'A', reason: 'r', status: 'arrived' }),
      appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'B', reason: 'r', status: 'vitals' }),
      appt({ day: 'jeu', start: '10:15', dur: 30, patient: 'C', reason: 'r', status: 'arrived' }),
    ];
    // Force « now » in the past so isLate never fires on these confirmed-ish rows.
    const { container } = render(<AgendaGrid days={DAYS} appointments={overlap} today="jeu" now="08:00" />);
    const blocks = container.querySelectorAll('.ag-daycol').item(3).querySelectorAll('.ag-block');
    expect(blocks.length).toBe(3);
    // Le cluster a 3 cols (3 RDV se chevauchent partiellement) → chaque bloc
    // doit avoir un width calc'd ≈ 33% et un left distinct.
    const leftValues = Array.from(blocks).map((b) => (b as HTMLElement).style.left);
    const widthValues = Array.from(blocks).map((b) => (b as HTMLElement).style.width);
    // Tous les blocs en collision ont width: calc(...% - 8px) et left: calc(...% + 4px).
    widthValues.forEach((w) => expect(w).toMatch(/calc\([\d.]+% - 8px\)/));
    leftValues.forEach((l) => expect(l).toMatch(/calc\([\d.]+% \+ 4px\)/));
    // Et au moins 2 valeurs de left distinctes (sinon les blocs s'empilent).
    expect(new Set(leftValues).size).toBeGreaterThan(1);
  });

  it('non-overlapping appointments keep the full column width (no inline left/width)', () => {
    const sequential: Appointment[] = [
      appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'A', reason: 'r', status: 'done' }),
      appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'B', reason: 'r', status: 'arrived' }),
    ];
    const { container } = render(<AgendaGrid days={DAYS} appointments={sequential} today="jeu" now="08:00" />);
    const blocks = container.querySelectorAll('.ag-daycol').item(3).querySelectorAll('.ag-block');
    expect(blocks.length).toBe(2);
    // Pas de chevauchement → aucun style inline width/left forcé (l'élément
    // hérite du width par défaut du .ag-block CSS, qui est 100% - inset).
    Array.from(blocks).forEach((b) => {
      const el = b as HTMLElement;
      expect(el.style.width).toBe('');
      expect(el.style.left).toBe('');
    });
  });

  it('PLANIFIE on today, past start +5 min, no arrival → gets ag-late class + aria suffix', () => {
    const items: Appointment[] = [
      // start 10:00 ; now 11:00 → late
      appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'Tahiri', reason: 'r', status: 'confirmed' }),
      // start 11:30 ; now 11:00 → not late
      appt({ day: 'jeu', start: '11:30', dur: 30, patient: 'BENALI', reason: 'r', status: 'confirmed' }),
    ];
    const { container } = render(<AgendaGrid days={DAYS} appointments={items} today="jeu" now="11:00" />);
    const blocks = container.querySelectorAll('.ag-daycol').item(3).querySelectorAll('.ag-block');
    expect(blocks.length).toBe(2);
    const tahiri = Array.from(blocks).find((b) => b.getAttribute('aria-label')?.startsWith('Tahiri'));
    const benali = Array.from(blocks).find((b) => b.getAttribute('aria-label')?.startsWith('BENALI'));
    expect(tahiri).toBeDefined();
    expect(benali).toBeDefined();
    expect(tahiri?.className).toMatch(/\bag-late\b/);
    expect(tahiri?.getAttribute('aria-label')).toMatch(/\(en retard\)$/);
    // Le RDV futur (11:30) ne doit PAS être taggué retard.
    expect(benali?.className).not.toMatch(/\bag-late\b/);
    expect(benali?.getAttribute('aria-label')).not.toMatch(/\(en retard\)/);
  });

  it('PLANIFIE within 5-min grace window (start +3 min) is NOT yet late', () => {
    const items: Appointment[] = [
      appt({ day: 'jeu', start: '11:00', dur: 30, patient: 'GraceUser', reason: 'r', status: 'confirmed' }),
    ];
    // now = 11:03 → only 3 minutes late, under the 5-minute grace threshold.
    const { container } = render(<AgendaGrid days={DAYS} appointments={items} today="jeu" now="11:03" />);
    const block = container.querySelector('.ag-block');
    expect(block?.className).not.toMatch(/\bag-late\b/);
  });

  it('PLANIFIE on a different day than `today` is never marked late (mirror walk)', () => {
    const items: Appointment[] = [
      appt({ day: 'mar', start: '09:00', dur: 30, patient: 'AnotherDay', reason: 'r', status: 'confirmed' }),
    ];
    const { container } = render(<AgendaGrid days={DAYS} appointments={items} today="jeu" now="15:00" />);
    const block = container.querySelector('.ag-block');
    expect(block?.className).not.toMatch(/\bag-late\b/);
  });

  it('done (CLOS) keeps ag-done class — colors come from CSS, locked at the class level', () => {
    const items: Appointment[] = [
      appt({ day: 'jeu', start: '08:30', dur: 30, patient: 'AlamiMohamedd', reason: 'r', status: 'done' }),
    ];
    const { container } = render(<AgendaGrid days={DAYS} appointments={items} today="jeu" now="11:00" />);
    const block = container.querySelector('.ag-block');
    expect(block?.className).toMatch(/\bag-done\b/);
    // Sanity : pas marqué late, le retard ne concerne que les confirmed.
    expect(block?.className).not.toMatch(/\bag-late\b/);
  });

  it('consult (EN_CONSULTATION) keeps ag-consult class — saphir-filled treatment lives in CSS', () => {
    const items: Appointment[] = [
      appt({ day: 'jeu', start: '10:45', dur: 30, patient: 'Lahlou', reason: 'Grossesse', status: 'consult' }),
    ];
    const { container } = render(<AgendaGrid days={DAYS} appointments={items} today="jeu" now="11:00" />);
    const block = container.querySelector('.ag-block');
    expect(block?.className).toMatch(/\bag-consult\b/);
  });

  // ── Multi-doctor split (iso batch3 maquette) ─────────────────────────
  // En vue Jour + « Tous les médecins », l'agenda doit rendre N colonnes
  // (une par médecin) à la place d'une seule colonne fusionnée. La walk
  // manual-QA a montré que c'est le seul moyen de distinguer qui fait quoi.
  describe('Multi-doctor lane split', () => {
    const lanes = [
      { id: 'doc-a', name: 'Dr Bennani', dotColor: '#1E4DAB' },
      { id: 'doc-b', name: 'Dr Boutaleb', dotColor: '#2F8F6B' },
      { id: 'doc-c', name: 'Dr El Amrani', dotColor: '#C68A2E' },
    ];
    const dayOnly: WeekDay[] = [DAYS[3]!]; // Jeudi

    it('renders N header cells + N day columns (one per doctor lane)', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'P1', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'P2', reason: 'r', status: 'arrived', practitionerId: 'doc-b' }),
      ];
      const { container } = render(
        <AgendaGrid days={dayOnly} appointments={items} today="jeu" now="08:00" jourMode doctorLanes={lanes} />
      );
      // 1 header vide (heure) + 3 headers médecin = 4 cells.
      const headers = container.querySelectorAll('.ag-header-cell');
      expect(headers.length).toBe(4);
      // 3 colonnes lane visibles (.ag-daycol.ag-lane), pas .ag-daycol unique.
      const lanesCols = container.querySelectorAll('.ag-daycol.ag-lane');
      expect(lanesCols.length).toBe(3);
      // Chaque header lane porte la pastille + le nom + le count.
      const laneHeaders = container.querySelectorAll('.ag-header-cell.ag-lane-header');
      expect(laneHeaders.length).toBe(3);
      expect(laneHeaders[0]?.textContent).toMatch(/Dr Bennani/);
      expect(laneHeaders[1]?.textContent).toMatch(/Dr Boutaleb/);
      expect(laneHeaders[2]?.textContent).toMatch(/Dr El Amrani/);
    });

    it('appointments are routed to their doctor lane only (filtered by practitionerId)', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'BennaniPatient', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'ElAmraniPatient', reason: 'r', status: 'arrived', practitionerId: 'doc-c' }),
      ];
      const { container } = render(
        <AgendaGrid days={dayOnly} appointments={items} today="jeu" now="08:00" jourMode doctorLanes={lanes} />
      );
      const lanesCols = container.querySelectorAll('.ag-daycol.ag-lane');
      // Lane Bennani contient seulement « BennaniPatient ».
      expect(lanesCols[0]?.querySelector('.ag-name')?.textContent).toBe('BennaniPatient');
      expect(lanesCols[0]?.querySelectorAll('.ag-block').length).toBe(1);
      // Lane Boutaleb vide.
      expect(lanesCols[1]?.querySelectorAll('.ag-block').length).toBe(0);
      // Lane El Amrani contient « ElAmraniPatient ».
      expect(lanesCols[2]?.querySelector('.ag-name')?.textContent).toBe('ElAmraniPatient');
      expect(lanesCols[2]?.querySelectorAll('.ag-block').length).toBe(1);
    });

    it('lane header shows per-doctor RDV count', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'X1', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'X2', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
        appt({ day: 'jeu', start: '11:00', dur: 30, patient: 'X3', reason: 'r', status: 'arrived', practitionerId: 'doc-c' }),
      ];
      const { container } = render(
        <AgendaGrid days={dayOnly} appointments={items} today="jeu" now="08:00" jourMode doctorLanes={lanes} />
      );
      const counts = Array.from(container.querySelectorAll('.ag-header-cell.ag-lane-header .ag-day-count')).map((n) => n.textContent);
      expect(counts).toEqual(['2 RDV', '0 RDV', '1 RDV']);
    });

    it('falls back to single-day rendering when doctorLanes is omitted (jourMode only)', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'Single', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
      ];
      const { container } = render(
        <AgendaGrid days={dayOnly} appointments={items} today="jeu" now="08:00" jourMode />
      );
      // Pas de lane-header → on retombe sur le header jour standard (d-lbl + d-num).
      expect(container.querySelectorAll('.ag-header-cell.ag-lane-header').length).toBe(0);
      expect(container.querySelectorAll('.ag-daycol.ag-lane').length).toBe(0);
      expect(container.querySelector('.d-lbl')?.textContent).toBe('Jeudi');
    });
  });

  // ── Doctor avatars on cards (iso maquette user 2026-05-28 week view) ──
  describe('Doctor avatars (multi-praticien)', () => {
    const pracMap = {
      'doc-a': { initials: 'SB', color: '#1E4DAB', name: 'Dr Bennani Sofia' },
      'doc-c': { initials: 'YE', color: '#C68A2E', name: 'Dr El Amrani Youssef' },
    };

    it('renders a .ag-doctor-avatar with correct initials + color when practitionerMap provides a match', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'P1', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="08:00" practitionerMap={pracMap} />
      );
      const avatar = container.querySelector('.ag-doctor-avatar') as HTMLElement | null;
      expect(avatar).not.toBeNull();
      expect(avatar?.textContent).toBe('SB');
      expect(avatar?.style.background).toBe('rgb(30, 77, 171)'); // #1E4DAB
      expect(avatar?.getAttribute('aria-label')).toBe('Dr Bennani Sofia');
    });

    it('omits the avatar when practitionerId is absent OR not in the map', () => {
      const items: Appointment[] = [
        // Pas de practitionerId — solo mode / fixture sans backend mapping
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'NoPid', reason: 'r', status: 'arrived' }),
        // practitionerId mais pas dans la map (cas où la liste pract n'inclut pas ce médecin)
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'StrangerDoc', reason: 'r', status: 'arrived', practitionerId: 'doc-zzz-not-in-map' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="08:00" practitionerMap={pracMap} />
      );
      // Aucun avatar ne doit être rendu — pas de pratitcionerId connu.
      expect(container.querySelectorAll('.ag-doctor-avatar').length).toBe(0);
    });

    it('omits the avatar entirely when practitionerMap is not provided (single-doctor mode)', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '09:00', dur: 30, patient: 'P1', reason: 'r', status: 'arrived', practitionerId: 'doc-a' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="08:00" />
      );
      // En l'absence de map, on n'affiche pas d'avatar (mode solo : pas de
      // valeur ajoutée à colorer par médecin, tout est le même).
      expect(container.querySelectorAll('.ag-doctor-avatar').length).toBe(0);
    });
  });

  // ── Tooltip hover (low-res / collisions) ─────────────────────────────
  // Bottle de la walk user 2026-05-28 : « en low-res la carte tronque, ajoute
  // hover pour avoir les infos ». title natif HTML porte patient + heure +
  // durée + statut + motif + médecin + allergie + retard.
  describe('Tooltip title (low-res / collision rescue)', () => {
    const pracMap = {
      'doc-a': { initials: 'SB', color: '#1E4DAB', name: 'Dr Bennani Sofia' },
    };

    it('block carries a multiline title with patient + time + duration + status + reason', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'Khadija Tahiri', reason: 'Contrôle diabète', status: 'arrived' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="09:00" />
      );
      const block = container.querySelector('.ag-block') as HTMLElement | null;
      expect(block).not.toBeNull();
      const lines = block!.getAttribute('title')?.split('\n') ?? [];
      expect(lines[0]).toBe('Khadija Tahiri');
      expect(lines[1]).toBe('10:00 · 30 min — Arrivé');
      expect(lines).toContain('Motif : Contrôle diabète');
    });

    it('title includes the doctor name when practitionerMap matches', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'P1', reason: 'r', status: 'confirmed', practitionerId: 'doc-a' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="08:00" practitionerMap={pracMap} />
      );
      const block = container.querySelector('.ag-block') as HTMLElement | null;
      expect(block?.getAttribute('title')).toMatch(/Médecin : Dr Bennani Sofia/);
    });

    it('title shows « En retard » when the slot is past start +5 min and not arrived', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'LateP', reason: 'r', status: 'confirmed' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="11:00" />
      );
      const block = container.querySelector('.ag-block') as HTMLElement | null;
      // Status FR doit basculer sur « En retard » dans le tooltip — pas
      // « Confirmé » (qui n'expose pas l'urgence à la secrétaire).
      expect(block?.getAttribute('title')).toMatch(/— En retard/);
    });

    it('title includes the allergy warning when present', () => {
      const items: Appointment[] = [
        appt({ day: 'jeu', start: '10:00', dur: 30, patient: 'AllergicP', reason: 'r', status: 'arrived', allergy: 'Aspirine' }),
      ];
      const { container } = render(
        <AgendaGrid days={DAYS} appointments={items} today="jeu" now="08:00" />
      );
      const block = container.querySelector('.ag-block') as HTMLElement | null;
      expect(block?.getAttribute('title')).toMatch(/Allergie : Aspirine/);
    });
  });
});
