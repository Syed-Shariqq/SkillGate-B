import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import RecruiterLayout from "@/layouts/RecruiterLayout";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const LandingPage = React.lazy(() => import("@/pages/LandingPage"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));

const DemoLanding = React.lazy(() => import("@/pages/demo/DemoLanding"));
const DemoAssessment = React.lazy(() => import("@/pages/demo/DemoAssessment"));
const DemoResult = React.lazy(() => import("@/pages/demo/DemoResult"));

const RecruiterAuthPage = React.lazy(() => import("@/pages/auth/RecruiterAuthPage"));
const RecruiterOnboarding = React.lazy(() => import("@/pages/auth/RecruiterOnboarding"));
const PendingApprovalPage = React.lazy(() => import("@/pages/PendingApprovalPage"));


const AssessmentLanding = React.lazy(() => import("@/pages/assessment/AssessmentLanding"));
const AssessmentPage = React.lazy(() => import("@/pages/assessment/AssessmentPage"));
const AssessmentSubmitted = React.lazy(() => import("@/pages/assessment/AssessmentSubmitted"));
const AssessmentResult = React.lazy(() => import("@/pages/assessment/AssessmentResult"));
const AssessmentExpired = React.lazy(() => import("@/pages/assessment/AssessmentExpired"));
const AssessmentAlreadyTaken = React.lazy(() => import("@/pages/assessment/AssessmentAlreadyTaken"));
const AssessmentUnavailable = React.lazy(() => import("@/pages/candidate/AssessmentUnavailable"));

const RecruiterDashboard = React.lazy(() => import("@/pages/recruiter/dashboard/RecruiterDashboard"));
const CreateJob = React.lazy(() => import("@/pages/recruiter/jobs/CreateJob"));
const JobDetail = React.lazy(() => import("@/pages/recruiter/jobs/JobDetail"));
const JobSettings = React.lazy(() => import("@/pages/recruiter/jobs/JobSettings"));
const JobCreatedSuccess = React.lazy(() => import("@/pages/recruiter/jobs/JobCreatedSuccess"));
const AllJobs = React.lazy(() => import("@/pages/recruiter/jobs/AllJobs"));
const CandidateProfile = React.lazy(() => import("@/pages/recruiter/candidates/CandidateProfile"));
const RecruiterAnalytics = React.lazy(() => import("@/pages/recruiter/analytics/RecruiterAnalytics"));
const BillingPage = React.lazy(() => import("@/pages/recruiter/billing/BillingPage"));
const PlansPage = React.lazy(() => import("@/pages/recruiter/billing/PlansPage"));
const RecruiterSettings = React.lazy(() => import("@/pages/recruiter/settings/RecruiterSettings"));
const NotificationsPage = React.lazy(() => import("@/pages/recruiter/notifications/NotificationsPage"));

const AppRoutes = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-primary text-text-primary">
        <LoadingSpinner size="lg" />
      </div>
    }
  >
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/demo" element={<DemoLanding />} />
      <Route path="/demo/assessment" element={<DemoAssessment />} />
      <Route path="/demo/result" element={<DemoResult />} />

      <Route path="/assess/expired" element={<AssessmentExpired />} />
      <Route path="/assess/taken" element={<AssessmentAlreadyTaken />} />
      <Route path="/assessment-unavailable" element={<AssessmentUnavailable />} />
      <Route path="/assess/:token" element={<AssessmentLanding />} />
      <Route path="/assess/:token/test" element={<AssessmentPage />} />
      <Route path="/assess/:token/submitted" element={<AssessmentSubmitted />} />
      <Route path="/assess/:token/result/:assessmentId" element={<AssessmentResult />} />
      <Route path="/assessment/result" element={<AssessmentResult />} />
      <Route path="/assessment/result/:resultId" element={<AssessmentResult />} />

      <Route element={<PublicRoute />}>
        <Route path="/auth" element={<RecruiterAuthPage />} />
      </Route>

      <Route path="/onboarding" element={<RecruiterOnboarding />} />
      <Route path="/pending-approval" element={<PendingApprovalPage />} />


      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<RecruiterLayout><RecruiterDashboard /></RecruiterLayout>} />
        <Route path="/jobs/create" element={<RecruiterLayout><CreateJob /></RecruiterLayout>} />
        <Route path="/jobs/:jobId/success" element={<RecruiterLayout><JobCreatedSuccess /></RecruiterLayout>} />
        <Route path="/jobs/:jobId" element={<RecruiterLayout><JobDetail /></RecruiterLayout>} />
        <Route path="/jobs/:jobId/settings" element={<RecruiterLayout><JobSettings /></RecruiterLayout>} />
        <Route path="/jobs" element={<RecruiterLayout><AllJobs /></RecruiterLayout>} />
        <Route path="/candidates/:candidateId" element={<RecruiterLayout><CandidateProfile /></RecruiterLayout>} />
        <Route path="/analytics" element={<RecruiterLayout><RecruiterAnalytics /></RecruiterLayout>} />
        <Route path="/billing" element={<RecruiterLayout><BillingPage /></RecruiterLayout>} />
        <Route path="/billing/plans" element={<RecruiterLayout><PlansPage /></RecruiterLayout>} />
        <Route path="/settings" element={<RecruiterLayout><RecruiterSettings /></RecruiterLayout>} />
        <Route path="/notifications" element={<RecruiterLayout><NotificationsPage /></RecruiterLayout>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;