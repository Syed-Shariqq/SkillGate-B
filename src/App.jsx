import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import RecruiterAuthPage from "./pages/auth/RecruiterAuthPage";
import RecruiterOnboarding from "./pages/auth/RecruiterOnboarding";
import RecruiterDashboard from "./pages/recruiter/dashboard/RecruiterDashboard";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161B22",
              border: "1px solid #2A323C",
              color: "#E6EDF3",
            },
          }}
        />

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicRoute />}>
            <Route path="/auth" element={<RecruiterAuthPage />} />
          </Route>

          <Route path="/onboarding" element={<RecruiterOnboarding />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<RecruiterDashboard />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
