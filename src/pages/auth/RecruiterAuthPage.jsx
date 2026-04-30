import { useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
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
  const navigate = useNavigate();
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
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setFormError(error?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-primary text-text-primary lg:flex">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#161B22",
            border: "1px solid #2A323C",
            color: "#E6EDF3",
          },
          success: {
            iconTheme: {
              primary: "#238636",
              secondary: "#E6EDF3",
            },
          },
        }}
      />

      <section className="hidden min-h-screen w-[40%] flex-col justify-between border-r border-border-default bg-secondary px-10 py-9 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-lg font-bold text-white">
              SG
            </div>
            <span className="text-2xl font-semibold tracking-normal">
              SkillGate
            </span>
          </div>

          <div className="mt-20 max-w-sm">
            <h1 className="text-4xl font-semibold leading-tight">
              Hire smarter. Screen faster.
            </h1>
            <p className="mt-5 text-base text-text-secondary">
              A focused workspace for recruiter teams to evaluate candidates
              with signal-rich assessments and faster shortlists.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {trustPoints.map((point) => (
            <div key={point} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                <span className="h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-medium text-text-secondary">
                {point}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen w-full items-center justify-center px-5 py-10 lg:w-[60%] lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
                SG
              </div>
              <span className="text-xl font-semibold">SkillGate</span>
            </div>
          </div>

          <Card padding="lg" className="rounded-lg">
            <div className="mb-7">
              <p className="text-sm font-medium text-accent">Recruiter access</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {isSignup ? "Create your account" : "Welcome back"}
              </h2>
            </div>

            <div className="mb-7 grid grid-cols-2 rounded-lg border border-border-default bg-primary p-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleTabChange("signup")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-smooth ${
                  isSignup
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-hover-overlay hover:text-text-primary"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleTabChange("login")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-smooth ${
                  !isSignup
                    ? "bg-accent text-white"
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
                  />
                  <Input
                    label="Work Email"
                    name="workEmail"
                    type="email"
                    value={form.workEmail}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.workEmail}
                    disabled={loading}
                    autoComplete="email"
                  />
                  <Input
                    label="Password (min 8 chars)"
                    name="signupPassword"
                    type="password"
                    value={form.signupPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.signupPassword}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Email"
                    name="loginEmail"
                    type="email"
                    value={form.loginEmail}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.loginEmail}
                    disabled={loading}
                    autoComplete="email"
                  />
                  <Input
                    label="Password"
                    name="loginPassword"
                    type="password"
                    value={form.loginPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={fieldErrors.loginPassword}
                    disabled={loading}
                    autoComplete="current-password"
                  />

                  <div className="flex justify-end">
                    {/* TODO: Wire forgot password flow. */}
                    <a href="#forgot-password" className="text-sm font-medium">
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
                className="w-full"
              >
                {isSignup ? "Sign Up" : "Log In"}
              </Button>
            </form>

            {formError && (
              <p className="mt-4 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
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
