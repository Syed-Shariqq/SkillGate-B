import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidUrl = (value) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) return false;

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`,
    );

    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
};

const RecruiterOnboarding = () => {
  const navigate = useNavigate();
  const { user, profile, updateCompanyDetails } = useAuth();

  const [form, setForm] = useState({
    companyName: "",
    companyWebsite: "",
    workEmail: user?.email || "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.is_onboarded) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, profile?.is_onboarded]);

  const validateField = (name, value = form[name]) => {
    const trimmedValue = value.trim();

    if (name === "companyName") {
      return trimmedValue ? "" : "Company name is required";
    }

    if (name === "companyWebsite") {
      if (!trimmedValue) return "Company website is required";
      return isValidUrl(trimmedValue) ? "" : "Enter a valid company website";
    }

    if (name === "workEmail") {
      if (!trimmedValue) return "Work email is required";
      return emailPattern.test(trimmedValue) ? "" : "Enter a valid email address";
    }

    return "";
  };

  const validateForm = () => {
    return ["companyName", "companyWebsite", "workEmail"].reduce(
      (errors, field) => {
        const error = validateField(field);

        if (error) {
          errors[field] = error;
        }

        return errors;
      },
      {},
    );
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

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: validateField(name, value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setFormError("");

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    if (!user?.id) {
      setFormError("Your session could not be found. Please log in again.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await updateCompanyDetails(user.id, {
        company_name: form.companyName.trim(),
        company_website: form.companyWebsite.trim(),
        work_email: form.workEmail.trim(),
      });

      if (error) {
        setFormError(error.message || "Could not save company details");
        return;
      }

      navigate("/dashboard");
    } catch (error) {
      setFormError(error?.message || "Could not save company details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-5 py-10 text-text-primary">
      <Card padding="lg" className="w-full max-w-120 rounded-lg">
        <div className="mb-7">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
                SG
              </div>
              <span className="text-lg font-semibold">SkillGate</span>
            </div>
            <span className="rounded-md border border-border-default bg-primary px-3 py-1 text-xs font-medium text-text-secondary">
              Step 1 of 1
            </span>
          </div>

          <h1 className="text-2xl font-semibold">Set up your company</h1>
          <p className="mt-2 text-sm text-text-secondary">
            This takes 30 seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Input
            label="Company Name"
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={fieldErrors.companyName}
            disabled={loading}
            autoComplete="organization"
          />

          <Input
            label="Company Website"
            name="companyWebsite"
            type="url"
            placeholder="https://company.com"
            value={form.companyWebsite}
            onChange={handleChange}
            onBlur={handleBlur}
            error={fieldErrors.companyWebsite}
            disabled={loading}
            autoComplete="url"
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

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
            className="w-full"
          >
            Continue to Dashboard
          </Button>
        </form>

        {formError && (
          <p className="mt-4 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
            {formError}
          </p>
        )}
      </Card>
    </main>
  );
};

export default RecruiterOnboarding;
