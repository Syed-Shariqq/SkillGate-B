import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import skillGateLogo from "@/assets/skillGate-logo.png";

const RejectedPage = () => {
  const { isAuthenticated, isRejected, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!isRejected) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-5 py-10 text-text-primary">
      <Card padding="lg" className="w-full max-w-md rounded-xl border border-border-default bg-secondary text-center shadow-lg animate-fade-in-up">
        <div className="flex flex-col items-center">
          <img src={skillGateLogo} alt="SkillGate Logo" className="h-10 mb-8 object-contain" />
          
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
            Registration Declined
          </h1>
          
          <p className="mb-6 text-sm text-text-secondary leading-relaxed">
            We are unable to approve your recruiter account at this time. Based on the information provided during onboarding, we could not verify your professional association or company profile.
          </p>

          <div className="rounded-lg bg-tertiary p-4 mb-8 text-left text-xs border border-border-default w-full">
            <h4 className="font-semibold text-text-primary mb-1">Need assistance?</h4>
            <p className="text-text-secondary leading-normal">
              If you believe this was an error, please reach out to our support team directly to verify your company details and reactivate your registration.
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={handleLogout}
            loading={loggingOut}
            className="w-full h-11"
          >
            Log Out
          </Button>
        </div>
      </Card>
    </main>
  );
};

export default RejectedPage;
