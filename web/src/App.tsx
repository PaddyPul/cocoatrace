import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthCtx } from './components/auth/AuthProvider';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/ToastProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MarketplacePage from './pages/MarketplacePage';
import ListingDetailPage from './pages/ListingDetailPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ShipmentDetailPage from './pages/ShipmentDetailPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import { FarmsPage, BatchesPage, HoldingsPage, ContractsPage, ShipmentsPage, PaymentsPage, EvidencePage, AuditPage, CertsPage } from './pages/DataPages';
import FarmDetailPage from './pages/FarmDetailPage';
import BatchDetailPage from './pages/BatchDetailPage';
import HoldingDetailPage from './pages/HoldingDetailPage';
import OffersPage from './pages/OffersPage';
import MyListingsPage from './pages/MyListingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthCtx();
  if (!user) return <Navigate to="/login" replace />;
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthCtx();
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user } = useAuthCtx();
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
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
          <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
          <Route path="/certs" element={<ProtectedRoute><CertsPage /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
