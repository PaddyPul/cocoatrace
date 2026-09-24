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
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/p/:slug" element={<ErrorBoundary><PublicProductPage /></ErrorBoundary>} />
          <Route path="/accept-invite/:token" element={<ErrorBoundary><AcceptInvitationPage /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ProtectedRoute><ControlTowerPage /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><ExperienceHomePage /></ProtectedRoute>} />
          <Route path="/source/new" element={<ProtectedRoute><SourcingBriefPage /></ProtectedRoute>} />
          <Route path="/source/compare" element={<ProtectedRoute><CompareOffersPage /></ProtectedRoute>} />
          <Route path="/supply/new" element={<ProtectedRoute><PublishSupplyPage /></ProtectedRoute>} />
          <Route path="/deal-room/:id" element={<ProtectedRoute><DealRoomPage /></ProtectedRoute>} />
          <Route path="/demo" element={<ProtectedRoute><InvestorDemoPage /></ProtectedRoute>} />
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
          <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/payments/:id" element={<ProtectedRoute><PaymentDetailPage /></ProtectedRoute>} />
          <Route path="/evidence" element={<ProtectedRoute><EvidencePage /></ProtectedRoute>} />
          <Route path="/recalls" element={<ProtectedRoute><RecallCenterPage /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
          <Route path="/certs" element={<ProtectedRoute><CertsPage /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
