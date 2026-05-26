import { createBrowserRouter, Navigate } from 'react-router-dom';
import LandingPage from '@/features/landing/LandingPage';
import LoginPage from '@/features/login/LoginRoute';
import RegisterPage from '@/features/register/RegisterPage';
import OnboardingPage from '@/features/onboarding/OnboardingPage';
import ForceChangePasswordPage from '@/features/auth/ForceChangePasswordPage';
import AgendaRoute from '@/features/agenda';
import DashboardRoute from '@/features/dashboard/DashboardRoute';
import DossierRoute from '@/features/dossier-patient';
import PatientsListPage from '@/features/dossier-patient/PatientsListRoute';
import SalleAttenteRoute from '@/features/salle-attente';
import PriseRDVMobilePage from '@/features/prise-rdv/PriseRDVPage.mobile';
import PriseConstantesRoute from '@/features/prise-constantes';
import ConsultationRoute from '@/features/consultation';
import OrdonnancePdfPage from '@/features/prescription/OrdonnancePdfRoute';
import FacturationPage from '@/features/facturation/FacturationRoute';
import ApercuFacturePage from '@/features/facturation/ApercuFactureRoute';
import { Placeholder } from '@/features/_placeholders/Placeholder';
import ParametragePage from '@/features/parametres/ParametrageRoute';
import ProfilPage from '@/features/profil/ProfilPage';
import VaccinationsQueueRoute from '@/features/vaccination/VaccinationsQueueRoute';
import PregnancesQueueRoute from '@/features/grossesse/PregnancesQueueRoute';
import StockArticlesRoute from '@/features/stock/StockArticlesRoute';
import HospitalisationRoute from '@/features/hospitalisation/HospitalisationRoute';
import StockArticleDetailRoute from '@/features/stock/StockArticleDetailRoute';
import CataloguePage from '@/features/catalogue/CatalogueRoute';
import ChargesPage from '@/features/charges/ChargesRoute';
import LabCatalogueRoute from '@/features/catalogue/LabCatalogueRoute';
import ImagingCatalogueRoute from '@/features/catalogue/ImagingCatalogueRoute';
import InternalRequestsQueuePage from '@/features/internal-requests/QueuePage';
// ADR-035 v2 (2026-05-20) — messagerie iso-maquette : canaux + DMs + fils patient,
// 100% piloté par le backend V048 (chat_conversation kind-aware, mentions, réactions,
// urgent, pinned, threading). `features/messages/` consomme les hooks `useChannels`,
// `useDirectMessages`, `usePatientThreads`, `useConversation`, `useSendMessage`.
import MessagesRoute from '@/features/messages';
import { AppLayout } from '@/components/shell/AppLayout';
import { RequireAuth, RequireRole, RequirePermission, GuestOnly, RequireOnboardingComplete } from '@/lib/auth/RequireAuth';

/**
 * careplus route tree.
 *
 * The authenticated routes are grouped under a pathless <AppLayout> route so
 * the persistent chrome (Sidebar, ⌘K spotlight) mounts ONCE and survives
 * navigation between pages — soft router transitions no longer remount the
 * sidebar / its 4 polling hooks. Pages still call <Screen title=... right=...>
 * for their per-page Topbar + workspace + right panel.
 *
 * Routes that don't need the chrome (landing, login, onboarding) sit at the
 * top level as siblings.
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
    {
      path: '/',
      element: (
        <GuestOnly>
          <LandingPage />
        </GuestOnly>
      ),
    },
    {
      path: '/login',
      element: (
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      ),
    },
    {
      path: '/register',
      element: (
        <GuestOnly>
          <RegisterPage />
        </GuestOnly>
      ),
    },
    {
      path: '/onboarding',
      element: (
        <RequireRole roles={['ADMIN', 'MEDECIN']}>
          <OnboardingPage />
        </RequireRole>
      ),
    },
    {
      // V044 — force-change-password is reachable for any authenticated user
      // whose passwordChangeRequired flag is set. We use RequireAuth (which
      // intentionally skips its own redirect when pathname is this route) so
      // unauthenticated visitors bounce to /login.
      path: '/force-change-password',
      element: (
        <RequireAuth>
          <ForceChangePasswordPage />
        </RequireAuth>
      ),
    },
    {
      element: (
        <RequireOnboardingComplete>
          <AppLayout />
        </RequireOnboardingComplete>
      ),
      children: [
        {
          path: '/dashboard',
          element: (
            <RequireAuth>
              <DashboardRoute />
            </RequireAuth>
          ),
        },
        {
          path: '/agenda',
          element: (
            <RequirePermission permission="APPOINTMENT_READ">
              <AgendaRoute />
            </RequirePermission>
          ),
        },
        {
          path: '/patients',
          element: (
            <RequirePermission permission="PATIENT_READ">
              <PatientsListPage />
            </RequirePermission>
          ),
        },
        {
          path: '/patients/:id',
          element: (
            <RequirePermission permission="PATIENT_READ">
              <DossierRoute />
            </RequirePermission>
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
          path: '/prescriptions/:id',
          element: (
            <RequireAuth>
              <OrdonnancePdfPage />
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
            <RequirePermission permission="INVOICE_READ">
              <FacturationPage />
            </RequirePermission>
          ),
        },
        {
          path: '/facturation/:id/apercu',
          element: (
            <RequirePermission permission="INVOICE_READ">
              <ApercuFacturePage />
            </RequirePermission>
          ),
        },
        {
          path: '/vaccinations',
          element: (
            <RequireRole roles={['SECRETAIRE', 'ASSISTANT', 'MEDECIN', 'ADMIN']}>
              <VaccinationsQueueRoute />
            </RequireRole>
          ),
        },
        {
          path: '/grossesses',
          element: (
            <RequireRole roles={['SECRETAIRE', 'ASSISTANT', 'MEDECIN', 'ADMIN']}>
              <PregnancesQueueRoute />
            </RequireRole>
          ),
        },
        {
          path: '/stock',
          element: (
            <RequireRole roles={['SECRETAIRE', 'ASSISTANT', 'MEDECIN', 'ADMIN']}>
              <StockArticlesRoute />
            </RequireRole>
          ),
        },
        {
          path: '/hospitalisation',
          element: (
            <RequireRole roles={['SECRETAIRE', 'ASSISTANT', 'INFIRMIER', 'MEDECIN', 'ADMIN']}>
              <HospitalisationRoute />
            </RequireRole>
          ),
        },
        {
          path: '/stock/articles/:id',
          element: (
            <RequireRole roles={['SECRETAIRE', 'ASSISTANT', 'MEDECIN', 'ADMIN']}>
              <StockArticleDetailRoute />
            </RequireRole>
          ),
        },
        {
          // NB: guard is RequireAuth, not RequireRole ADMIN. On mobile (and as
          // the desktop fallback for non-admins) ParametrageRoute renders the
          // menu/profile hub that ALL roles need — it's the "Plus" tab target.
          // The admin-only desktop settings are gated INSIDE ParametrageRoute.
          // A route-level ADMIN guard bounced every non-admin to /agenda and
          // made every "Plus" module (dashboard, consultations, vaccinations,
          // grossesses, stock, messages, catalogue, profil) unreachable on mobile.
          path: '/parametres',
          element: (
            <RequireAuth>
              <ParametragePage />
            </RequireAuth>
          ),
        },
        {
          path: '/profil',
          element: (
            <RequireAuth>
              <ProfilPage />
            </RequireAuth>
          ),
        },
        {
          path: '/catalogue',
          element: (
            <RequireAuth>
              <CataloguePage />
            </RequireAuth>
          ),
        },
        {
          path: '/catalogue/analyses',
          element: (
            <RequireAuth>
              <LabCatalogueRoute />
            </RequireAuth>
          ),
        },
        {
          path: '/catalogue/radio',
          element: (
            <RequireAuth>
              <ImagingCatalogueRoute />
            </RequireAuth>
          ),
        },
        {
          // QA9-15 — charges du cabinet. Réservé ADMIN.
          path: '/charges',
          element: (
            <RequireRole roles={['ADMIN']}>
              <ChargesPage />
            </RequireRole>
          ),
        },
        {
          path: '/queue/:service',
          element: (
            <RequireRole roles={['LAB', 'RADIO', 'MEDECIN', 'ADMIN']}>
              <InternalRequestsQueuePage />
            </RequireRole>
          ),
        },
        {
          // Messagerie iso-maquette (ADR-035 v2 + V048) — canaux + DMs + fils patient.
          path: '/messages',
          element: (
            <RequireAuth>
              <MessagesRoute />
            </RequireAuth>
          ),
        },
        {
          path: '/messages/:conversationId',
          element: (
            <RequireAuth>
              <MessagesRoute />
            </RequireAuth>
          ),
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { future },
);
