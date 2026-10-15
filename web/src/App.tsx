import { lazy, Suspense } from 'react';
import { LanguageProvider } from './i18n/LanguageProvider';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuthCtx } from './components/auth/AuthProvider';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/ToastProvider';
import { webConfig } from './config';

const PilotLimitationsPage = lazy(() => import('./pages/PilotLimitationsPage'));
const EvidenceContributionPage = lazy(() => import('./pages/EvidenceContributionPage'));
const PasskeysPage = lazy(() => import('./pages/PasskeysPage'));
const PlatformFeesPage = lazy(() => import('./pages/PlatformFeesPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ControlTowerPage = lazy(() => import('./pages/ControlTowerPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const ContractDetailPage = lazy(() => import('./pages/ContractDetailPage'));
const ShipmentDetailPage = lazy(() => import('./pages/ShipmentDetailPage'));
const PaymentDetailPage = lazy(() => import('./pages/PaymentDetailPage'));
const FarmsPage = lazy(() => import('./pages/SourceFarmsPage'));
const BatchesPage = lazy(() => import('./pages/SourceBatchesPage'));
const HoldingsPage = lazy(() => import('./pages/InventoryPage'));
const ContractsPage = lazy(() => import('./pages/ContractRecordsPage'));
const ShipmentsPage = lazy(() => import('./pages/ShipmentRecordsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentRecordsPage'));
const EvidencePage = lazy(() => import('./pages/EvidenceRecordsPage'));
const AuditPage = lazy(() => import('./pages/AuditRecordsPage'));
const CertsPage = lazy(() => import('./components/catalog/CertificateRecordsPage'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'));
const FarmDetailPage = lazy(() => import('./pages/FarmDetailPage'));
const BatchDetailPage = lazy(() => import('./pages/BatchDetailPage'));
const HoldingDetailPage = lazy(() => import('./pages/HoldingDetailPage'));
const OffersPage = lazy(() => import('./pages/OffersPage'));
const MyListingsPage = lazy(() => import('./pages/MyListingsPage'));
const PublicProductPage = lazy(() => import('./pages/PublicProductPage'));
const RecallCenterPage = lazy(() => import('./pages/RecallCenterPage'));
const InvestorDemoPage = lazy(() => import('./pages/InvestorDemoPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const PilotTeamPage = lazy(() => import('./pages/PilotTeamPage'));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'));
const ExperienceHomePage = lazy(() => import('./pages/ExperienceHomePage'));
const SourcingBriefPage = lazy(() => import('./pages/SourcingBriefPage'));
const CompareOffersPage = lazy(() => import('./pages/CompareOffersPage'));
const PublishSupplyPage = lazy(() => import('./pages/PublishSupplyPage'));
const DealRoomPage = lazy(() => import('./pages/DealRoomPage'));
const DirectInventoryPage = lazy(() => import('./pages/DirectInventoryPage'));
const RequestAccessPage = lazy(() => import('./pages/RequestAccessPage'));
const AccessVerificationPage = lazy(() => import('./pages/AccessVerificationPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AccessControlsPage = lazy(() => import('./pages/AccessControlsPage'));
const AccessApplicationsPage = lazy(() => import('./pages/AccessApplicationsPage'));
const OperationsPage = lazy(() => import('./pages/OperationsPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboarding, onboardingLoading } = useAuthCtx();
  const location = useLocation();
  if (loading) return <main className="grid min-h-screen place-items-center bg-surface-darker"><div className="spinner" /></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mfa?.required && !user.mfa.verified) return <PasskeysPage />;
  if (onboardingLoading) return <main className="grid min-h-screen place-items-center bg-surface-darker"><div className="spinner" /></main>;
  if (onboarding && onboarding.status !== 'completed' && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthCtx();
  if (loading) return <main className="grid min-h-screen place-items-center bg-surface-darker"><div className="spinner" /></main>;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuthCtx();
  if (loading) return <main className="grid min-h-screen place-items-center bg-surface-darker"><div className="spinner" /></main>;
  return <Navigate to={user ? '/home' : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {webConfig.demoPreview && <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
        Supervised demo: synthetic records and simulated payments. Do not enter personal data or upload real documents.
      </div>}
      <AuthProvider>
        <LanguageProvider><ToastProvider>
        <ErrorBoundary><Suspense fallback={<main className="grid min-h-[60vh] place-items-center" role="status">Loading page…</main>}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/request-access" element={<PublicRoute><RequestAccessPage /></PublicRoute>} />
          <Route path="/verify-access" element={<ErrorBoundary><AccessVerificationPage /></ErrorBoundary>} />
          <Route path="/verify-access/:token" element={<ErrorBoundary><AccessVerificationPage /></ErrorBoundary>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/p/:slug" element={<ErrorBoundary><PublicProductPage /></ErrorBoundary>} />
          <Route path="/accept-invite/:token" element={<ErrorBoundary><AcceptInvitationPage /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ProtectedRoute><ControlTowerPage /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><ExperienceHomePage /></ProtectedRoute>} />
          <Route path="/source/new" element={<ProtectedRoute><SourcingBriefPage /></ProtectedRoute>} />
          <Route path="/source/compare" element={<ProtectedRoute><CompareOffersPage /></ProtectedRoute>} />
          <Route path="/supply/new" element={<ProtectedRoute><PublishSupplyPage /></ProtectedRoute>} />
          <Route path="/inventory/new" element={<ProtectedRoute><DirectInventoryPage /></ProtectedRoute>} />
          <Route path="/deal-room/:id" element={<ProtectedRoute><DealRoomPage /></ProtectedRoute>} />
          <Route path="/demo" element={webConfig.demoMode ? <ProtectedRoute><InvestorDemoPage /></ProtectedRoute> : <Navigate to="/home" replace />} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/pilot/limitations" element={<ProtectedRoute><PilotLimitationsPage /></ProtectedRoute>} />
          <Route path="/pilot" element={<ProtectedRoute><PilotTeamPage /></ProtectedRoute>} />
          <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
          <Route path="/listing/:id" element={<ProtectedRoute><ListingDetailPage /></ProtectedRoute>} />
          <Route path="/farms" element={<ProtectedRoute><FarmsPage /></ProtectedRoute>} />
          <Route path="/farms/:id" element={<ProtectedRoute><FarmDetailPage /></ProtectedRoute>} />
          <Route path="/batches" element={<ProtectedRoute><BatchesPage /></ProtectedRoute>} />
          <Route path="/batches/:id" element={<ProtectedRoute><BatchDetailPage /></ProtectedRoute>} />
          <Route path="/holdings" element={<ProtectedRoute><HoldingsPage /></ProtectedRoute>} />
          <Route path="/holdings/:id" element={<ProtectedRoute><HoldingDetailPage /></ProtectedRoute>} />
          <Route path="/offers" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetailPage /></ProtectedRoute>} />
          <Route path="/shipments" element={<ProtectedRoute><ShipmentsPage /></ProtectedRoute>} />
          <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentDetailPage /></ProtectedRoute>} />
          <Route path="/platform-fees" element={<ProtectedRoute><PlatformFeesPage /></ProtectedRoute>} />
          <Route path="/platform-fees/:id" element={<ProtectedRoute><PlatformFeesPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/payments/:id" element={<ProtectedRoute><PaymentDetailPage /></ProtectedRoute>} />
          <Route path="/evidence/contribute" element={<ProtectedRoute><EvidenceContributionPage /></ProtectedRoute>} />
          <Route path="/evidence" element={<ProtectedRoute><EvidencePage /></ProtectedRoute>} />
          <Route path="/recalls" element={<ProtectedRoute><RecallCenterPage /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
          <Route path="/certs" element={<ProtectedRoute><CertsPage /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
          <Route path="/access-controls" element={<ProtectedRoute><AccessControlsPage /></ProtectedRoute>} />
          <Route path="/access-applications" element={<ProtectedRoute><AccessApplicationsPage /></ProtectedRoute>} />
          <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />
          <Route path="/account/passkeys" element={<ProtectedRoute><PasskeysPage /></ProtectedRoute>} />
          <Route path="/account/security" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense></ErrorBoundary>
        </ToastProvider></LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
