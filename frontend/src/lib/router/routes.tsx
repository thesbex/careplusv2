import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '@/features/login/LoginPage';
import OnboardingPage from '@/features/onboarding/OnboardingPage';
import AgendaRoute from '@/features/agenda';
import DossierRoute from '@/features/dossier-patient';
import SalleAttenteRoute from '@/features/salle-attente';
import PriseRDVMobilePage from '@/features/prise-rdv/PriseRDVPage.mobile';
import PriseConstantesRoute from '@/features/prise-constantes';
import ConsultationRoute from '@/features/consultation';
import { Placeholder } from '@/features/_placeholders/Placeholder';
import { RequireAuth, GuestOnly } from '@/lib/auth/RequireAuth';

/**
 * careplus route tree.
 * Navigation mapping (mirrors DESIGN_SYSTEM.md §9):
 *   /login         → screen 12
 *   /onboarding    → screen 13
 *   /agenda        → screen 01 (placeholder until J4)
 *   /patients      → screen 03 (placeholder until J3)
 *   /salle         → screen 04 (placeholder until J5)
 *   /consultations → screen 06 (placeholder until J5)
 *   /facturation   → screen 09 (placeholder until J7)
 *   /parametres    → screen 11 (placeholder until J8)
 *
 * Lazy-load is deferred until screens are substantial enough to matter
 * (after J5); for now, all pages are small and splitting them would add
 * more request overhead than it saves.
 */
/** v7 future flags opt-in — keeps console clean and eases the eventual v7 upgrade. */
const future = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/login" replace /> },
    {
      path: '/login',
      element: (
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      ),
    },
    { path: '/onboarding', element: <OnboardingPage /> },
    {
      path: '/agenda',
      element: (
        <RequireAuth>
          <AgendaRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/patients',
      element: (
        <RequireAuth>
          <DossierRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/patients/:id',
      element: (
        <RequireAuth>
          <DossierRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/salle',
      element: (
        <RequireAuth>
          <SalleAttenteRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/rdv/new',
      element: (
        <RequireAuth>
          <PriseRDVMobilePage />
        </RequireAuth>
      ),
    },
    {
      path: '/constantes/:appointmentId',
      element: (
        <RequireAuth>
          <PriseConstantesRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/consultations',
      element: (
        <RequireAuth>
          <ConsultationRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/consultations/:id',
      element: (
        <RequireAuth>
          <ConsultationRoute />
        </RequireAuth>
      ),
    },
    {
      path: '/_unused_placeholder_consult',
      element: (
        <RequireAuth>
          <Placeholder
            active="consult"
            mobileTab="patients"
            title="Consultations"
            sprintDay="J5"
          />
        </RequireAuth>
      ),
    },
    {
      path: '/facturation',
      element: (
        <RequireAuth>
          <Placeholder active="factu" mobileTab="factu" title="Facturation" sprintDay="J7" />
        </RequireAuth>
      ),
    },
    {
      path: '/parametres',
      element: (
        <RequireAuth>
          <Placeholder active="params" mobileTab="menu" title="Paramètres" sprintDay="J8" />
        </RequireAuth>
      ),
    },
    { path: '*', element: <Navigate to="/login" replace /> },
  ],
  { future },
);
