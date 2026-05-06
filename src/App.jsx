import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Add page imports here
import InvestorPage from './pages/InvestorPage';
import LiveCodebaseExplorer from './pages/LiveCodebaseExplorer';
import Home from './pages/Home';
import PortalLogin from './pages/PortalLogin';
import InvestorPortal from './pages/InvestorPortal';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import Offering from './pages/Offering';
import { PortalAuthProvider } from '@/lib/PortalAuthContext';
import { TwilioDeviceProvider } from '@/lib/TwilioDeviceContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/" element={<Home />} />
      <Route path="/portal-login" element={<PortalLogin />} />
      <Route path="/portal" element={<InvestorPortal />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/offering" element={<Offering />} />
      <Route path="/investor-page" element={<InvestorPage />} />
      <Route path="/live-codebase-explorer" element={<LiveCodebaseExplorer />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider><PortalAuthProvider>
      <TwilioDeviceProvider><QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider></TwilioDeviceProvider>
    </PortalAuthProvider></AuthProvider>
  )
}

export default App