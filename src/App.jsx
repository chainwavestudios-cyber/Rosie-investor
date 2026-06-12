import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import InvestorPage from './pages/InvestorPage';
import LiveCodebaseExplorer from './pages/LiveCodebaseExplorer';
import DirectD from './pages/DirectD';
import Home from './pages/Home';
import PortalLogin from './pages/PortalLogin';
import InvestorPortal from './pages/InvestorPortal';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import Offering from './pages/Offering';
import OptIn from './pages/OptIn';
import OptInScreenshot from './pages/OptInScreenshot';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import RequestAccess from './pages/RequestAccess';
import { PortalAuthProvider } from '@/lib/PortalAuthContext';
import { TwilioDeviceProvider } from '@/lib/TwilioDeviceContext';

const PUBLIC_PATHS = ['/optin', '/optin/screenshot', '/privacy', '/terms', '/portal-login', '/admin-login', '/request-access'];

// Wraps protected routes — applies AuthProvider and its loading/error guards.
// Public routes bypass this entirely so they never trigger auth redirects.
const ProtectedShell = ({ children }) => {
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));

  if (isPublic) return children;

  return (
    <AuthProvider>
      <TwilioDeviceProvider>
        <AuthGate>{children}</AuthGate>
      </TwilioDeviceProvider>
    </AuthProvider>
  );
};

const AuthGate = ({ children }) => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PortalAuthProvider>
        <Router>
          <ProtectedShell>
            <Routes>
              {/* Public — no auth required */}
              <Route path="/optin" element={<OptIn />} />
              <Route path="/optin/screenshot" element={<OptInScreenshot />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/portal-login" element={<PortalLogin />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/request-access" element={<RequestAccess />} />
              {/* Protected */}
              <Route path="/" element={<Home />} />
              <Route path="/portal" element={<InvestorPortal />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/offering" element={<Offering />} />
              <Route path="/investor-page" element={<InvestorPage />} />
              <Route path="/live-codebase-explorer" element={<LiveCodebaseExplorer />} />
              <Route path="/DirectD" element={<DirectD />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </ProtectedShell>
        </Router>
      </PortalAuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;