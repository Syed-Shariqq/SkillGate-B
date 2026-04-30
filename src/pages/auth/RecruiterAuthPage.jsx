import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import skillGateLogo from "../../assets/skillGate-logo.png";
import { useAuth } from "../../hooks/useAuth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm = {
  fullName: "",
  workEmail: "",
  signupPassword: "",
  loginEmail: "",
  loginPassword: "",
};

const trustPoints = [
  "AI-powered screening",
  "No bias in shortlisting",
  "Save 10+ hours per hire",
];

const inputClassName =
  "h-11 rounded-md bg-primary/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_0_0_1px_rgba(255,255,255,0.01)] transition-[border-color,box-shadow,background-color] duration-200 focus:bg-primary focus:shadow-[0_0_0_3px_rgba(91,109,246,0.16),inset_0_1px_0_rgba(255,255,255,0.04)]";

const primaryButtonClassName =
  "h-11 w-full bg-gradient-to-r from-accent to-accent-hover shadow-[0_12px_28px_rgba(91,109,246,0.24)] transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(91,109,246,0.3)] active:translate-y-0 active:shadow-[0_8px_20px_rgba(91,109,246,0.22)]";

const getRequiredError = (value, label) => {
  return value.trim() ? "" : `${label} is required`;
};

const validateEmail = (value, label = "Email") => {
  const requiredError = getRequiredError(value, label);

  if (requiredError) return requiredError;
  if (!emailPattern.test(value.trim())) return "Enter a valid email address";

  return "";
};

const validatePassword = (value) => {
  const requiredError = getRequiredError(value, "Password");

  if (requiredError) return requiredError;
  if (value.length < 8) return "Password must be at least 8 characters";

  return "";
};

const RecruiterAuthPage = () => {
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState("signup");
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = activeTab === "signup";

  const activeFields = useMemo(() => {
    return isSignup
      ? ["fullName", "workEmail", "signupPassword"]
      : ["loginEmail", "loginPassword"];
  }, [isSignup]);

  const validateField = (name, value = form[name]) => {
    const validators = {
      fullName: () => getRequiredError(value, "Full name"),
      workEmail: () => validateEmail(value, "Work email"),
      signupPassword: () => validatePassword(value),
      loginEmail: () => validateEmail(value),
      loginPassword: () => validatePassword(value),
    };

    return validators[name]?.() || "";
  };

  const validateActiveForm = () => {
    return activeFields.reduce((errors, field) => {
      const error = validateField(field);

      if (error) {
        errors[field] = error;
      }

      return errors;
    }, {});
  };

  const handleTabChange = (tab) => {
    if (loading || tab === activeTab) return;

    setActiveTab(tab);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setFormError("");

    if (fieldErrors[name]) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [name]: validateField(name, value),
      }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    const error = validateField(name, value);

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: error,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setFormError("");

    const errors = validateActiveForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const response = isSignup
        ? await register({
            name: form.fullName.trim(),
            email: form.workEmail.trim(),
            password: form.signupPassword,
          })
        : await login({
            email: form.loginEmail.trim(),
            password: form.loginPassword,
          });

      if (response?.error) {
        setFormError(response.error.message || "Something went wrong");
        return;
      }

      if (isSignup) {
        toast.success("Check your email to confirm");
        setForm((currentForm) => ({
          ...currentForm,
          signupPassword: "",
        }));
      }
    } catch (error) {
      setFormError(error?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-primary text-text-primary lg:flex">
      <section className="relative hidden min-h-screen w-[40%] flex-col justify-between overflow-hidden border-r border-border-default bg-[linear-gradient(145deg,#161B22_0%,#111722_48%,#0D1117_100%)] px-12 py-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(91,109,246,0.14),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_38%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <img
              src={skillGateLogo}
              alt="SkillGate logo"
              className="h-11 w-11 rounded-lg border border-accent/25 object-cover shadow-[0_12px_32px_rgba(91,109,246,0.18)]"
            />
            <span className="text-2xl font-semibold tracking-normal">
              SkillGate
            </span>
          </div>

          <div className="mt-24 max-w-md">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-text-tertiary">
              Recruiter intelligence
            </p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-normal text-text-primary">
              Hire smarter. Screen faster.
            </h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-text-secondary">
              A focused workspace for recruiter teams to evaluate candidates
              with signal-rich assessments and faster shortlists.
            </p>
          </div>
        </div>

        <div className="relative space-y-5">
          {trustPoints.map((point) => (
            <div
              key={point}
              className="group flex items-center gap-4 rounded-lg border border-transparent px-1 py-1 transition-colors duration-200 hover:border-border-default/70 hover:bg-hover-overlay"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/30 bg-accent-soft shadow-[0_0_0_4px_rgba(91,109,246,0.04)] transition-transform duration-200 group-hover:scale-105">
                <span className="h-2.5 w-1.5 rotate-45 border-b-2 border-r-2 border-accent" />
              </span>
              <span className="text-sm font-medium text-text-secondary transition-colors duration-200 group-hover:text-text-primary">
                {point}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen w-full items-center justify-center bg-[linear-gradient(180deg,rgba(31,38,48,0.32),rgba(13,17,23,0)_34%)] px-5 py-10 lg:w-[60%] lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <img
                src={skillGateLogo}
                alt="SkillGate logo"
                className="h-10 w-10 rounded-lg border border-accent/25 object-cover shadow-[0_10px_28px_rgba(91,109,246,0.16)]"
              />
              <span className="text-xl font-semibold">SkillGate</span>
            </div>
          </div>

          <Card
            padding="lg"
            className="rounded-lg border-border-default/90 bg-[linear-gradient(180deg,rgba(22,27,34,0.94),rgba(22,27,34,0.86))] shadow-[0_24px_80px_rgba(0,0,0,0.34),0_0_0_1px_rgba(91,109,246,0.06)] backdrop-blur-xl"
          >
            <div className="mb-8">
              <p className="text-sm font-medium text-accent">
                Recruiter access
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-normal">
                {isSignup ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                {isSignup
                  ? "Start screening candidates with structured, signal-first assessments."
                  : "Log in to continue managing roles, candidates, and results."}
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 rounded-lg border border-border-default/90 bg-primary/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleTabChange("signup")}
                aria-pressed={isSignup}
                className={`rounded-md px-4 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.99] ${
                  isSignup
                    ? "bg-tertiary text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-text-secondary hover:bg-hover-overlay hover:text-text-primary"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleTabChange("login")}
                aria-pressed={!isSignup}
                className={`rounded-md px-4 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.99] ${
                  !isSignup
                    ? "bg-tertiary text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-text-secondary hover:bg-hover-overlay hover:text-text-primary"
                }`}
              >
                Log In
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {isSignup ? (
                <>
                  <Input
                    label="Full Name"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.fullName}
                    disabled={loading}
                    autoComplete="name"
                    className={inputClassName}
                  />
                  <Input
                    label="Work Email"
                    name="workEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={form.workEmail}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.workEmail}
                    disabled={loading}
                    autoComplete="email"
                    className={inputClassName}
                  />
                  <Input
                    label="Password (min 8 chars)"
                    name="signupPassword"
                    type="password"
                    placeholder="Create a secure password"
                    value={form.signupPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.signupPassword}
                    disabled={loading}
                    autoComplete="new-password"
                    className={inputClassName}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Email"
                    name="loginEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={form.loginEmail}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.loginEmail}
                    disabled={loading}
                    autoComplete="email"
                    className={inputClassName}
                  />
                  <Input
                    label="Password"
                    name="loginPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={form.loginPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.loginPassword}
                    disabled={loading}
                    autoComplete="current-password"
                    className={inputClassName}
                  />

                  <div className="flex justify-end">
                    {/* TODO: Wire forgot password flow. */}
                    <a
                      href="#forgot-password"
                      className="text-sm font-medium text-text-secondary transition-colors duration-200 hover:text-accent"
                    >
                      Forgot password?
                    </a>
                  </div>
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
                className={primaryButtonClassName}
              >
                {isSignup ? "Sign Up" : "Log In"}
              </Button>
            </form>

            {formError && (
              <p className="mt-5 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                {formError}
              </p>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
};

export default RecruiterAuthPage;
