import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import skillGateLogo from "@/assets/skillGate-logo.png";

const VerifyEmailConfirmPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, refreshProfile } = useAuth();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading"); // loading, verified, already_verified, invalid_token, token_expired, error
  const [errorMessage, setErrorMessage] = useState("");
  const requestTriggered = useRef(false);

  useEffect(() => {
    // Prevent React 18 StrictMode double mount triggering multiple database calls
    if (requestTriggered.current) return;
    requestTriggered.current = true;

    const performVerification = async () => {
      if (!token) {
        setStatus("invalid_token");
        setErrorMessage("Verification token is missing from the link.");
        return;
      }

      try {
        const { data, error } = await supabase.rpc("verify_email_with_token", {
          p_token: token,
        });

        if (error) {
          console.error("verify_email_with_token RPC failed:", error);
          setStatus("error");
          setErrorMessage(error.message || "An unexpected database error occurred.");
          return;
        }

        if (data && typeof data === "object") {
          if (data.success) {
            if (data.status === "already_verified") {
              setStatus("already_verified");
            } else {
              setStatus("verified");
            }

            // Sync user profile state if they are logged in
            let latestProfile = null;
            if (isAuthenticated) {
              const profileRes = await refreshProfile();
              if (profileRes && profileRes.data) {
                latestProfile = profileRes.data;
              }
            }

            // Redirect after 3 seconds
            setTimeout(() => {
              if (isAuthenticated) {
                if (latestProfile?.is_onboarded) {
                  navigate("/dashboard", { replace: true });
                } else {
                  navigate("/onboarding", { replace: true });
                }
              } else {
                navigate("/auth", {
                  replace: true,
                  state: { message: "Email verified successfully! Please log in." },
                });
              }
            }, 3000);
          } else {
            // Handle error status from RPC response
            if (data.error === "invalid_token") {
              setStatus("invalid_token");
              setErrorMessage("The verification link is invalid or has already been used.");
            } else if (data.error === "token_expired") {
              setStatus("token_expired");
              setErrorMessage("The verification link has expired. Please request a new one.");
            } else {
              setStatus("error");
              setErrorMessage(data.error || "Verification failed.");
            }
          }
        } else {
          setStatus("error");
          setErrorMessage("Invalid response format received from server.");
        }
      } catch (err) {
        console.error("Verification execution error:", err);
        setStatus("error");
        setErrorMessage("An unexpected error occurred during email verification.");
      }
    };

    performVerification();
  }, [token, isAuthenticated, refreshProfile, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-5 py-10 text-text-primary">
      <Card
        padding="lg"
        className="w-full max-w-md rounded-xl border border-border-default bg-secondary text-center shadow-lg animate-fade-in-up"
      >
        <div className="flex flex-col items-center">
          <img src={skillGateLogo} alt="SkillGate Logo" className="h-10 mb-8 object-contain" />

          {status === "loading" && (
            <div className="flex flex-col items-center py-6">
              <LoadingSpinner size="lg" className="text-accent mb-4" />
              <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
              <p className="text-sm text-text-secondary">Please wait while we confirm your account.</p>
            </div>
          )}

          {(status === "verified" || status === "already_verified") && (
            <div className="flex flex-col items-center py-6">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-text-primary">
                {status === "already_verified" ? "Already Verified!" : "Email Verified!"}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Your email address has been successfully confirmed. You will be redirected shortly...
              </p>
            </div>
          )}

          {(status === "invalid_token" || status === "token_expired" || status === "error") && (
            <div className="flex flex-col items-center py-6 w-full">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2 text-text-primary">Verification Failed</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6 px-4">
                {errorMessage}
              </p>
              <Button
                variant="secondary"
                onClick={() => navigate("/auth", { replace: true })}
                className="w-full h-11"
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
};

export default VerifyEmailConfirmPage;
