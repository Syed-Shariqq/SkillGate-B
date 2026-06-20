import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/config/supabase";
import { updatePassword } from "@/services/auth/authService";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import skillGateLogo from "@/assets/skillGate-logo.png";

const inputClassName =
  "h-11 rounded-md bg-primary/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_0_0_1px_rgba(255,255,255,0.01)] transition-[border-color,box-shadow,background-color] duration-200 focus:bg-primary focus:shadow-[0_0_0_3px_rgba(91,109,246,0.16),inset_0_1px_0_rgba(255,255,255,0.04)]";

const primaryButtonClassName =
  "h-11 w-full bg-gradient-to-r from-accent to-accent-hover shadow-[0_12px_28px_rgba(91,109,246,0.24)] transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(91,109,246,0.3)] active:translate-y-0 active:shadow-[0_8px_20px_rgba(91,109,246,0.22)]";

const getRequiredError = (value, label) => {
  return value.trim() ? "" : `${label} is required`;
};

const validatePassword = (value) => {
  const requiredError = getRequiredError(value, "Password");

  if (requiredError) return requiredError;
  if (value.length < 8) return "Password must be at least 8 characters";

  return "";
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [hashError, setHashError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const error = params.get("error");
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");

      if (error || errorCode) {
        setHashError(errorDescription || "The reset link is invalid or has expired.");
      }
    }
  }, []);

  const validateField = (name, value) => {
    if (name === "password") {
      return validatePassword(value);
    }
    if (name === "confirmPassword") {
      const requiredError = getRequiredError(value, "Confirm password");
      if (requiredError) return requiredError;
      if (value !== form.password) return "Passwords do not match";
    }
    return "";
  };

  const validateForm = () => {
    const errors = {};
    const passwordError = validateField("password", form.password);
    const confirmPasswordError = validateField("confirmPassword", form.confirmPassword);

    if (passwordError) errors.password = passwordError;
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

    return errors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validateField(name, value),
      }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    const error = validateField(name, value);
    setFieldErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setFormError("");

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const { error } = await updatePassword(form.password);

      if (error) {
        setFormError(error.message || "Failed to update password. Please try again.");
      } else {
        await supabase.auth.signOut();
        setSuccess(true);
        setTimeout(() => {
          navigate("/auth", { replace: true });
        }, 1500);
      }
    } catch (err) {
      console.error("Password update error:", err);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || success;

  if (hashError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-primary px-5 py-10 text-text-primary">
        <div className="w-full max-w-md">
          <Card
            padding="lg"
            className="rounded-lg border-border-default/90 bg-[linear-gradient(180deg,rgba(22,27,34,0.94),rgba(22,27,34,0.86))] shadow-[0_24px_80px_rgba(0,0,0,0.34),0_0_0_1px_rgba(91,109,246,0.06)] backdrop-blur-xl text-center"
          >
            <div className="mb-8 flex flex-col items-center">
              <img src={skillGateLogo} alt="SkillGate Logo" className="h-10 mb-8 object-contain" />
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                Link expired or invalid
              </h2>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                {hashError}
              </p>
            </div>

            <Button
              onClick={() => navigate("/auth", { replace: true })}
              variant="primary"
              className={primaryButtonClassName}
            >
              Request a new link
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-primary px-5 py-10 text-text-primary">
      <div className="w-full max-w-md">
        <Card
          padding="lg"
          className="rounded-lg border-border-default/90 bg-[linear-gradient(180deg,rgba(22,27,34,0.94),rgba(22,27,34,0.86))] shadow-[0_24px_80px_rgba(0,0,0,0.34),0_0_0_1px_rgba(91,109,246,0.06)] backdrop-blur-xl"
        >
          <div className="mb-8 flex flex-col items-center">
            <img src={skillGateLogo} alt="SkillGate Logo" className="h-10 mb-8 object-contain" />
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Set a new password
            </h2>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed text-center">
              Please enter your new password below to secure your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="New Password"
              name="password"
              type="password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={fieldErrors.password}
              disabled={loading || success}
              autoComplete="new-password"
              className={inputClassName}
            />

            <Input
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              placeholder="Repeat your new password"
              value={form.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={fieldErrors.confirmPassword}
              disabled={loading || success}
              autoComplete="new-password"
              className={inputClassName}
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={isSubmitDisabled}
              className={primaryButtonClassName}
            >
              Update Password
            </Button>
          </form>

          {formError && (
            <p className="mt-5 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {formError}
            </p>
          )}

          {success && (
            <p className="mt-5 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              Password updated. Redirecting to login...
            </p>
          )}
        </Card>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
