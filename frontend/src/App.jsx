import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import PortalLayout from './components/PortalLayout';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import RoleLogin from './pages/RoleLogin';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import CarRegistration from './pages/CarRegistration';
import VideoVerification from './pages/VideoVerification';
import PolicySelection from './pages/PolicySelection';
import PolicyHistory from './pages/PolicyHistory';
import PolicyDetails from './pages/PolicyDetails';
import PolicyCertificate from './pages/PolicyCertificate';
import Payment from './pages/Payment';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailurePage from './pages/PaymentFailurePage';
import Claim from './pages/Claim';
import ClaimAssessment from './pages/ClaimAssessment';
import ClaimHistory from './pages/ClaimHistory';
import ClaimDetails from './pages/ClaimDetails';
import AdminDashboard from './pages/admin/AdminDashboard';
import VehicleMasterAdmin from './pages/admin/VehicleMasterAdmin';
import RepairCostMasterAdmin from './pages/admin/RepairCostMasterAdmin';
import AgentPortal from './pages/agent/AgentPortal';
import VerifierPortal from './pages/verifier/VerifierPortal';

function PublicLayout() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

function LegacyPolicyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/customer/policies/${id}`} replace />;
}

function LegacyCertificateRedirect() {
  const { id } = useParams();
  return <Navigate to={`/customer/policies/${id}/certificate`} replace />;
}

function LegacyClaimRedirect() {
  const { id } = useParams();
  return <Navigate to={`/customer/claims/${id}`} replace />;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Routes>
        <Route
          path="/customer/*"
          element={
            <ProtectedRoute roles={['user']}>
              <PortalLayout
                role="user"
                title="Customer Portal"
                subtitle="Manage policies, claims, vehicles, and payments."
              />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="car-registration" element={<CarRegistration />} />
          <Route path="video-verification/:vehicleId" element={<VideoVerification />} />
          <Route path="policy" element={<PolicySelection />} />
          <Route path="policies" element={<PolicyHistory />} />
          <Route path="policies/:id" element={<PolicyDetails />} />
          <Route path="policies/:id/certificate" element={<PolicyCertificate />} />
          <Route path="payment" element={<Payment />} />
          <Route path="payment/success" element={<PaymentSuccessPage />} />
          <Route path="payment/failure" element={<PaymentFailurePage />} />
          <Route path="claim" element={<Claim />} />
          <Route path="claims" element={<ClaimHistory />} />
          <Route path="claims/:id/assessment" element={<ClaimAssessment />} />
          <Route path="claims/:id" element={<ClaimDetails />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path="/agent/*"
          element={
            <ProtectedRoute roles={['agent', 'admin']}>
              <PortalLayout
                role="agent"
                title="Agent Portal"
                subtitle="Manage policy catalog, pricing, and add-on configuration."
              />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AgentPortal defaultTab="Dashboard" />} />
          <Route path="providers" element={<AgentPortal defaultTab="Providers" />} />
          <Route path="pricing" element={<AgentPortal defaultTab="Pricing" />} />
          <Route path="addons" element={<AgentPortal defaultTab="Add-ons" />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path="/verifier/*"
          element={
            <ProtectedRoute roles={['verifier', 'admin']}>
              <PortalLayout
                role="verifier"
                title="Verifier Portal"
                subtitle="Review pending vehicle verification requests and decisions."
              />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<VerifierPortal />} />
          <Route path="queue" element={<VerifierPortal defaultView="queue" />} />
          <Route path="pending" element={<Navigate to="/verifier/queue" replace />} />
          <Route path="verify" element={<VerifierPortal defaultView="verify" />} />
          <Route path="verify/:vehicleId" element={<VerifierPortal defaultView="verify" />} />
          <Route path="history" element={<VerifierPortal defaultView="history" />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <PortalLayout
                role="admin"
                title="Admin Portal"
                subtitle="Control users, policies, claims, payments, and platform operations."
              />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard defaultTab="Overview" />} />
          <Route path="users" element={<AdminDashboard defaultTab="Users" />} />
          <Route path="cars" element={<AdminDashboard defaultTab="Cars" />} />
          <Route path="policies" element={<AdminDashboard defaultTab="Policies" />} />
          <Route path="claims" element={<AdminDashboard defaultTab="Claims" />} />
          <Route path="payments" element={<AdminDashboard defaultTab="Payments" />} />
          <Route path="audit-logs" element={<AdminDashboard defaultTab="Audit Logs" />} />
          <Route path="catalog" element={<AdminDashboard defaultTab="Catalog" />} />
          <Route path="vehicle-master" element={<VehicleMasterAdmin />} />
          <Route path="repair-master" element={<RepairCostMasterAdmin />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/:role" element={<RoleLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/car-registration" element={<Navigate to="/customer/car-registration" replace />} />
          <Route path="/policy" element={<Navigate to="/customer/policy" replace />} />
          <Route path="/policies" element={<Navigate to="/customer/policies" replace />} />
          <Route path="/policies/:id" element={<LegacyPolicyRedirect />} />
          <Route path="/policies/:id/certificate" element={<LegacyCertificateRedirect />} />
          <Route path="/payment" element={<Navigate to="/customer/payment" replace />} />
          <Route path="/claim" element={<Navigate to="/customer/claim" replace />} />
          <Route path="/claims" element={<Navigate to="/customer/claims" replace />} />
          <Route path="/claims/:id" element={<LegacyClaimRedirect />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/agent" element={<Navigate to="/agent/dashboard" replace />} />
          <Route path="/verifier" element={<Navigate to="/verifier/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  );
}
