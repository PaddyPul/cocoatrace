import { LanguageProvider } from './i18n/LanguageProvider';
import PlatformFeesPage from './pages/PlatformFeesPage';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuthCtx } from './components/auth/AuthProvider';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/ToastProvider';
import LoginPage from './pages/LoginPage';
import ControlTowerPage from './pages/ControlTowerPage';
import MarketplacePage from './pages/MarketplacePage';
import ListingDetailPage from './pages/ListingDetailPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ShipmentDetailPage from './pages/ShipmentDetailPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import { FarmsPage, BatchesPage, HoldingsPage, ContractsPage, ShipmentsPage, PaymentsPage, EvidencePage, AuditPage, CertsPage, OrganizationsPage } from './pages/DataPages';
import FarmDetailPage from './pages/FarmDetailPage';
import BatchDetailPage from './pages/BatchDetailPage';
import HoldingDetailPage from './pages/HoldingDetailPage';
import OffersPage from './pages/OffersPage';
import MyListingsPage from './pages/MyListingsPage';
import PublicProductPage from './pages/PublicProductPage';
import RecallCenterPage from './pages/RecallCenterPage';
import InvestorDemoPage from './pages/InvestorDemoPage';
import ProductsPage from './pages/ProductsPage';
import OnboardingPage from './pages/OnboardingPage';
import PilotTeamPage from './pages/PilotTeamPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import ExperienceHomePage from './pages/ExperienceHomePage';
import SourcingBriefPage from './pages/SourcingBriefPage';
import CompareOffersPage from './pages/CompareOffersPage';
import PublishSupplyPage from './pages/PublishSupplyPage';
import DealRoomPage from './pages/DealRoomPage';
import DirectInventoryPage from './pages/DirectInventoryPage';
import RequestAccessPage from './pages/RequestAccessPage';
import AccessVerificationPage from './pages/AccessVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AccessControlsPage from './pages/AccessControlsPage';
import AccessApplicationsPage from './pages/AccessApplicationsPage';
import { webConfig } from './config';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboarding, onboardingLoading } = useAuthCtx();
  const location = useLocation();
  if (loading) return <main className="grid min-h-screen place-items-center bg-surface-darker"><div className="spinner" /></main>;
  if (!user) return <Navigate to="/login" replace />;
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
          <Route path="/evidence" element={<ProtectedRoute><EvidencePage /></ProtectedRoute>} />
          <Route path="/recalls" element={<ProtectedRoute><RecallCenterPage /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
          <Route path="/certs" element={<ProtectedRoute><CertsPage /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
          <Route path="/access-controls" element={<ProtectedRoute><AccessControlsPage /></ProtectedRoute>} />
          <Route path="/access-applications" element={<ProtectedRoute><AccessApplicationsPage /></ProtectedRoute>} />
          <Route path="/account/security" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </ToastProvider></LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
