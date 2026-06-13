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
import DemoLanding from "./pages/demo/DemoLanding";
import DemoAssessment from "./pages/demo/DemoAssessment";
import DemoResult from "./pages/demo/DemoResult";
import AssessmentResult from "./pages/assessment/AssessmentResult";

// Recruiter Pages
import CreateJob from "./pages/recruiter/jobs/CreateJob";
import JobDetail from "./pages/recruiter/jobs/JobDetail";
import JobSettings from "./pages/recruiter/jobs/JobSettings";
import JobCreatedSuccess from "./pages/recruiter/jobs/JobCreatedSuccess";
import CandidateProfile from "./pages/recruiter/candidates/CandidateProfile";
import RecruiterAnalytics from "./pages/recruiter/analytics/RecruiterAnalytics";
import BillingPage from "./pages/recruiter/billing/BillingPage";
import RecruiterSettings from "./pages/recruiter/settings/RecruiterSettings";
import AllJobs from "./pages/recruiter/jobs/AllJobs";

// Assessment Pages
import AssessmentExpired from "./pages/assessment/AssessmentExpired";
import AssessmentAlreadyTaken from "./pages/assessment/AssessmentAlreadyTaken";
import AssessmentLanding from "./pages/assessment/AssessmentLanding";
import AssessmentPage from "./pages/assessment/AssessmentPage";
import AssessmentSubmitted from "./pages/assessment/AssessmentSubmitted";
import RecruiterLayout from "./layouts/RecruiterLayout";

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
          <Route path="/demo" element={<DemoLanding />} />
          <Route path="/demo/assessment" element={<DemoAssessment />} />
          <Route path="/demo/result" element={<DemoResult />} />
          <Route path="/assessment/result" element={<AssessmentResult />} />
          <Route path="/assessment/result/:resultId" element={<AssessmentResult />} />
          
          {/* Public Assessment Routes */}
          <Route path="/assess/expired" element={<AssessmentExpired />} />
          <Route path="/assess/taken" element={<AssessmentAlreadyTaken />} />
          <Route path="/assess/:token" element={<AssessmentLanding />} />
          <Route path="/assess/:token/test" element={<AssessmentPage />} />
          <Route path="/assess/:token/submitted" element={<AssessmentSubmitted />} />
          <Route path="/assess/:token/result/:assessmentId" element={<AssessmentResult />} />

          <Route element={<PublicRoute />}>
            <Route path="/auth" element={<RecruiterAuthPage />} />
          </Route>

          <Route path="/onboarding" element={<RecruiterOnboarding />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<RecruiterLayout><RecruiterDashboard /></RecruiterLayout>} />
            <Route path="/jobs/create" element={<RecruiterLayout><CreateJob /></RecruiterLayout>} />
            <Route path="/jobs/:jobId/success" element={<RecruiterLayout><JobCreatedSuccess /></RecruiterLayout>} />
            <Route path="/jobs/:jobId" element={<RecruiterLayout><JobDetail /></RecruiterLayout>} />
            <Route path="/jobs/:jobId/settings" element={<RecruiterLayout><JobSettings /></RecruiterLayout>} />
            <Route path="/candidates/:candidateId" element={<RecruiterLayout><CandidateProfile /></RecruiterLayout>} />
            <Route path="/analytics" element={<RecruiterLayout><RecruiterAnalytics /></RecruiterLayout>} />
            <Route path="/billing" element={<RecruiterLayout><BillingPage /></RecruiterLayout>} />
            <Route path="/jobs" element={<RecruiterLayout><AllJobs /></RecruiterLayout>} />
            <Route path="/settings" element={<RecruiterLayout><RecruiterSettings /></RecruiterLayout>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

