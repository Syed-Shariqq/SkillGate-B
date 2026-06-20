import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import skillGateLogo from "@/assets/skillGate-logo.png";

const PendingApprovalPage = () => {
  const { isAuthenticated, isPendingApproval, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!isPendingApproval) {
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
          
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
            Account Under Review
          </h1>
          
          <p className="mb-6 text-sm text-text-secondary leading-relaxed">
            Your account is currently awaiting manual verification because you signed up with a generic email address. We review new accounts to ensure a professional and secure platform for all recruiters.
          </p>

          <div className="rounded-lg bg-tertiary p-4 mb-8 text-left text-xs border border-border-default w-full">
            <h4 className="font-semibold text-text-primary mb-1">What happens next?</h4>
            <p className="text-text-secondary leading-normal">
              An administrator will review your onboarding details. You will receive an email confirmation once your account has been approved. No further action is required at this time.
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

export default PendingApprovalPage;
