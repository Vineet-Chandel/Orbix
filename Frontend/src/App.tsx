import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SignInPage from './LandingPages/Auth-Pages/Signin/Landing';
import SignUpPage from './LandingPages/Auth-Pages/Signup/Landing';
import MainLanding from "./LandingPages/Main-Landing-Pages/Landing";
import CustomersPage from "./LandingPages/Customers/Landing";
import PricingPage from "./LandingPages/Pricing/Landing";
import SupportPage from "./LandingPages/Support/Landing";
import PlatformPage from "./LandingPages/Platform/Landing";
import Dashboard from "./app/Dashboard/Landing";
import { ToastProvider } from "./context/ToastContext";

const WorkspaceRedirect = () => {
  const user = localStorage.getItem("orbix_user");
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth/signin" replace />;
};

const App = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLanding />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/demo" element={<SupportPage />} />
          <Route path="/workspace" element={<WorkspaceRedirect />} />
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/signin" element={<SignInPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;