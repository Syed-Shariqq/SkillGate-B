import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/config/supabase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import skillGateLogo from "@/assets/skillGate-logo.png";

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isEmailVerified, user, refreshProfile, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // If already verified, route the user dynamically using the existing gates/flow
  if (isEmailVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage("");
    setErrorMsg("");
    try {
      const { data, error } = await refreshProfile();
      if (error) {
        setErrorMsg("Failed to refresh status. Please try again.");
      } else if (data && data.email_verified) {
        // Successful verification routes through the existing flow automatically
        navigate("/dashboard", { replace: true });
      } else {
        setMessage("We checked, but your email is still unverified. Please confirm your inbox.");
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred while checking status.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage("");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-email", {
        body: { userId: user.id },
      });

      let technicalMessage = "";
      let isCooldown = false;
      let cooldownSeconds = 60;

      if (error) {
        console.error("send-verification-email invoke returned error:", error);
        if (error.name === "FunctionsHttpError" && error.context) {
          try {
            const body = await error.context.json();
            if (body && body.error === "cooldown_active") {
              isCooldown = true;
              cooldownSeconds = Number(body.remainingSeconds) || 60;
            } else {
              technicalMessage = body?.error || body?.message || error.message;
            }
          } catch (_e) {
            technicalMessage = error.message;
          }
        } else {
          technicalMessage = error.message || String(error);
        }
      } else if (data && data.error) {
        if (data.error === "cooldown_active") {
          isCooldown = true;
          cooldownSeconds = Number(data.remainingSeconds) || 60;
        } else {
          technicalMessage = data.error;
        }
      }

      if (isCooldown) {
        setCooldown(cooldownSeconds);
        return;
      }

      if (technicalMessage) {
        // Map technical messages to recruiter-friendly errors
        const msg = technicalMessage.toLowerCase();
        if (msg.includes("network") || msg.includes("timeout") || msg.includes("abort")) {
          setErrorMsg("We encountered a network issue. Please check your connection and try again.");
        } else if (msg.includes("invalid recipient email") || msg.includes("invalid or missing profile email")) {
          setErrorMsg("Your account email address appears to be invalid or missing. Please contact support.");
        } else if (msg.includes("failed to send email") || msg.includes("resend_api_key")) {
          setErrorMsg("Email delivery is temporarily unavailable. Our team has been notified, please try again shortly.");
        } else if (msg.includes("profile not found") || msg.includes("userid")) {
          setErrorMsg("We could not find your recruiter profile. Please log out and sign up again.");
        } else if (msg.includes("non-2xx") || msg.includes("http error")) {
          setErrorMsg("We could not process your request at this time. Please try again in a few moments.");
        } else {
          setErrorMsg(technicalMessage);
        }
        return;
      }

      setMessage("A fresh verification link has been sent to your email address.");
      setCooldown(60);
    } catch (err) {
      console.error("send-verification-email invoke throw:", err);
      setErrorMsg("We encountered a network issue. Please check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-5 py-10 text-text-primary">
      <Card
        padding="lg"
        className="w-full max-w-md rounded-xl border border-border-default bg-secondary text-center shadow-lg animate-fade-in-up"
      >
        <div className="flex flex-col items-center">
          <img src={skillGateLogo} alt="SkillGate Logo" className="h-10 mb-8 object-contain" />

          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent animate-pulse">
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
                d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5"
              />
            </svg>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
            Verify your email
          </h1>

          <p className="mb-6 text-sm text-text-secondary leading-relaxed">
            We sent a verification link to your work email address:
            <br />
            <strong className="text-text-primary mt-1 block break-all">{user?.email}</strong>
          </p>

          <p className="mb-8 text-xs text-text-secondary leading-relaxed">
            Please click the link in that email to confirm your account and access the recruiter dashboard.
          </p>

          <div className="space-y-3 w-full mb-8">
            <Button
              variant="primary"
              onClick={handleRefresh}
              loading={refreshing}
              disabled={refreshing || resending}
              className="w-full h-11"
            >
              Refresh Status
            </Button>

            <Button
              variant="secondary"
              onClick={handleResend}
              loading={resending}
              disabled={refreshing || resending || cooldown > 0}
              className="w-full h-11"
            >
              Resend Verification Email
            </Button>

            {cooldown > 0 && (
              <p className="text-xs text-text-secondary mt-1">
                You can request another email in {cooldown} seconds.
              </p>
            )}
          </div>

          {message && (
            <p className="mb-6 w-full rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success text-left">
              {message}
            </p>
          )}

          {errorMsg && (
            <p className="mb-6 w-full rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error text-left">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleLogout}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors underline focus:outline-none"
          >
            Log Out
          </button>
        </div>
      </Card>
    </main>
  );
};

export default VerifyEmailPage;
