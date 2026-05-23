import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getSessionFromStorage,
  getJobByToken,
  startAssessment,
} from "../../services/assessment/assessmentService";

import toast from "react-hot-toast";

export default function AssessmentLanding() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Initialize resumable session state directly during useState initialization to avoid effect cascading renders
  const [activeSession] = useState(() => {
    const { data: session } = getSessionFromStorage();
    return session?.assessmentId ? session : null;
  });

  const [resumable] = useState(() => {
    const { data: session } = getSessionFromStorage();
    return Boolean(session?.assessmentId);
  });

  // State
  const [job, setJob] = useState(null);
  const [pageStatus, setPageStatus] = useState("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const mountedRef = useRef(true);
  const submitLockRef = useRef(false);

  // Mount Flow & Data Fetching (driven by token & retryCount to satisfy set-state-in-effect and react-hooks rules)
  useEffect(() => {
    mountedRef.current = true;

    const loadData = async () => {
      setPageStatus("loading");
      try {
        const res = await getJobByToken(token);
        if (!mountedRef.current) return;

        if (res.error) {
          setPageStatus("error");
          return;
        }

        const { data, status } = res;
        if (
          status === "not_found" ||
          status === "inactive" ||
          status === "limit_reached"
        ) {
          navigate("/assess/expired", { replace: true });
          return;
        }

        if (status === "expired") {
          navigate("/assess/expired", {
            replace: true,
            state: {
              jobTitle: data?.title,
              company: data?.company_name,
              expiredAt: data?.link_expires_at,
            },
          });
          return;
        }

        if (status === "valid") {
          setJob(data);
          setPageStatus("valid");
        } else {
          setPageStatus("error");
        }
      } catch {
        if (!mountedRef.current) return;
        setPageStatus("error");
      }
    };

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [token, navigate, retryCount]);

  // Email Validation & Telemetry Check
  const validateAndCheckEmail = useCallback(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Please enter a valid email address");
      setEmailVerified(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      setEmailVerified(false);
      return;
    }

    setEmailError("");
    setIsCheckingEmail(true);

    // Simulate checkAlreadyTaken -> always returns { taken: false }
    setTimeout(() => {
      if (!mountedRef.current) return;
      setEmailVerified(true);
      setIsCheckingEmail(false);
    }, 500);
  }, [email]);

  // Name Validation
  const validateName = useCallback((val) => {
    const trimmed = val.trim();
    const hasLetter = /[a-zA-Z]/.test(trimmed);
    if (trimmed.length < 2 || trimmed.length > 100 || !hasLetter) {
      setNameError("Please enter your full name (2-100 characters)");
      return false;
    }
    setNameError("");
    return true;
  }, []);

  // Input Change Handlers
  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (nameError) {
      const trimmed = val.trim();
      const hasLetter = /[a-zA-Z]/.test(trimmed);
      if (trimmed.length >= 2 && trimmed.length <= 100 && hasLetter) {
        setNameError("");
      }
    }
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setEmailVerified(false);
    if (emailError) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(val.trim())) {
        setEmailError("");
      }
    }
  };

  // Submit Flow
  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      if (isSubmitting || submitLockRef.current) return;

      // Revalidate Name and Email
      const isNameValid = validateName(name);

      const emailTrimmed = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = emailTrimmed && emailRegex.test(emailTrimmed);

      if (!isEmailValid) {
        setEmailError("Please enter a valid email address");
        setEmailVerified(false);
      }

      if (!isNameValid || !isEmailValid) {
        return;
      }

      submitLockRef.current = true;
      setIsSubmitting(true);

      try {
        const res = await startAssessment({
          name: name.trim(),
          email: emailTrimmed,
          token,
        });

        if (!mountedRef.current) return;

        if (res.error) {
          toast.error(res.error.message || "Failed to start assessment");
          setIsSubmitting(false);
          submitLockRef.current = false;
          return;
        }

        navigate(`/assess/${token}/test`);
      } catch (err) {
        if (!mountedRef.current) return;
        toast.error(err?.message || "Failed to start assessment");
        setIsSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [name, email, token, isSubmitting, validateName, navigate],
  );

  // Loading State
  if (pageStatus === "loading") {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4">
        {/* Spinner SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="w-8 h-8 animate-spin text-accent"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-text-secondary text-sm mt-4 font-medium select-none">
          Loading assessment...
        </p>
      </div>
    );
  }

  // Error State
  if (pageStatus === "error") {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-secondary border border-border-default rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <h2 className="text-error font-semibold text-xl mb-2">
            Unable to load assessment
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Please check the link and try again
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors font-medium text-sm select-none"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Sticky Top Navigation */}
      <header className="sticky top-0 z-20 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left Section */}
        <div className="text-sm font-medium select-none">
          <span className="font-bold text-text-primary">SkillGate</span>
          <span className="text-text-tertiary mx-2">×</span>
          <span className="text-text-primary">{job?.company_name}</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer select-none">
              Guidelines
            </span>
            <span className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer select-none">
              Technical Requirements
            </span>
            <span className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer select-none">
              Support
            </span>
            <div className="w-px h-4 bg-border-default" />
            <span className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer select-none">
              Sign In
            </span>
          </div>

          <button
            type="button"
            className="border border-border-default rounded-lg px-3 py-1.5 text-xs text-text-primary hover:bg-tertiary transition-colors font-medium select-none"
          >
            Candidate Portal
          </button>
        </div>
      </header>

      {/* Resume Active Session Banner */}
      {resumable && activeSession && (
        <div className="bg-tertiary border-l-4 border-accent rounded-lg p-4 mx-4 md:mx-auto md:max-w-2xl mt-4 flex items-start gap-3 shadow-sm select-none animate-fade-in-up">
          {/* Rotate CCW SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0 mt-0.5"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <polyline points="3 3 3 8 8 8" />
          </svg>

          <div className="flex-1">
            <h3 className="text-text-primary text-sm font-semibold">
              Active Session Found
            </h3>
            <p className="text-text-secondary text-xs mt-0.5">
              You have a paused assessment in progress. Your work was saved.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/assess/${token}/test`)}
              className="mt-2 text-accent text-sm font-semibold hover:text-accent-hover transition-colors block text-left"
            >
              Resume Now →
            </button>
          </div>
        </div>
      )}

      {/* Job Hero Section */}
      <section className="pt-8 md:pt-12 pb-6 px-4 text-center select-none">
        <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-3 block">
          SKILLGATE × {job?.company_name}
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
          {job?.title} Assessment
        </h1>

        {/* Pills Row */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {job?.employment_type && (
            <span className="bg-secondary border border-border-default rounded-full px-3 py-1 text-sm text-text-secondary">
              {job.employment_type}
            </span>
          )}
          {job?.department && (
            <span className="bg-secondary border border-border-default rounded-full px-3 py-1 text-sm text-text-secondary">
              {job.department}
            </span>
          )}
          {job?.location && (
            <span className="bg-secondary border border-border-default rounded-full px-3 py-1 text-sm text-text-secondary">
              {job.location}
            </span>
          )}
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto w-full px-4 mb-8 select-none">
        {/* Duration */}
        <div className="bg-secondary border border-border-default rounded-xl p-4 flex flex-col items-center text-center shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xl font-bold text-text-primary mt-2">
            {job?.time_limit_minutes ?? 45} mins
          </span>
          <span className="text-xs text-text-tertiary mt-1">Duration</span>
        </div>

        {/* Questions */}
        <div className="bg-secondary border border-border-default rounded-xl p-4 flex flex-col items-center text-center shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="text-xl font-bold text-text-primary mt-2">
            {job?.question_count ?? 15}
          </span>
          <span className="text-xs text-text-tertiary mt-1">Questions</span>
        </div>

        {/* Skills */}
        <div className="bg-secondary border border-border-default rounded-xl p-4 flex flex-col items-center text-center shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0"
          >
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
          <span className="text-xl font-bold text-text-primary mt-2">
            {job?.skill_count ?? 3} Core
          </span>
          <span className="text-xs text-text-tertiary mt-1">Skills tested</span>
        </div>

        {/* Pass Threshold */}
        <div className="bg-secondary border border-border-default rounded-xl p-4 flex flex-col items-center text-center shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0"
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
            <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          </svg>
          <span className="text-xl font-bold text-text-primary mt-2">
            {job?.min_score_threshold ?? 75}%
          </span>
          <span className="text-xs text-text-tertiary mt-1">
            Pass Threshold
          </span>
        </div>
      </section>

      {/* Form Card */}
      <section className="max-w-lg mx-auto w-full px-4 mb-8">
        <div className="bg-secondary border border-border-default rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-text-primary text-lg font-semibold mb-6">
            Candidate Details
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name Field */}
            <div className="mb-4 flex flex-col">
              <label
                htmlFor="candidate-name"
                className="font-mono text-xs uppercase tracking-wider text-text-tertiary mb-2 block font-medium"
              >
                Full Name
              </label>
              <input
                id="candidate-name"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Jane Doe"
                aria-invalid={Boolean(nameError)}
                className={`w-full bg-tertiary border rounded-lg px-4 py-3 text-text-primary text-sm focus:outline-none transition-colors ${
                  nameError
                    ? "border-error"
                    : "border-border-default focus:border-accent"
                }`}
              />
              {nameError && (
                <span className="text-error text-xs mt-1.5 font-medium select-none">
                  {nameError}
                </span>
              )}
            </div>

            {/* Email Field */}
            <div className="mb-4 flex flex-col">
              <label
                htmlFor="candidate-email"
                className="font-mono text-xs uppercase tracking-wider text-text-tertiary mb-2 block font-medium"
              >
                Email Address
              </label>
              <div className="relative w-full">
                <input
                  id="candidate-email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={validateAndCheckEmail}
                  placeholder="jane.doe@example.com"
                  aria-invalid={Boolean(emailError)}
                  className={`w-full bg-tertiary border rounded-lg px-4 py-3 pr-10 text-text-primary text-sm focus:outline-none transition-colors ${
                    emailError
                      ? "border-error"
                      : "border-border-default focus:border-accent"
                  }`}
                />

                {/* Verification Status Icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none">
                  {isCheckingEmail && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="animate-spin w-4 h-4 text-text-tertiary"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        className="opacity-75"
                      />
                    </svg>
                  )}

                  {!isCheckingEmail && emailVerified && !emailError && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 text-success"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </div>
              </div>
              {emailError && (
                <span className="text-error text-xs mt-1.5 font-medium select-none">
                  {emailError}
                </span>
              )}

              {/* Resumable Info Box */}
              <div className="bg-tertiary border border-border-default rounded-lg p-3 mt-3 flex items-start gap-2 select-none shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-tertiary shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-text-secondary text-xs leading-relaxed">
                  Resumable: Use the same email if you need to pause and return
                  later. Progress is bound to this address.
                </p>
              </div>
            </div>

            {/* Before You Begin Section */}
            <div className="border-t border-border-default pt-6 mt-6 select-none">
              <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary mb-3 block font-semibold">
                Before You Begin
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {/* Timed Session */}
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-tertiary shrink-0 mt-0.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-text-secondary text-xs leading-relaxed">
                    Timed session
                  </span>
                </div>

                {/* Tab switching tracked */}
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-tertiary shrink-0 mt-0.5"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-text-secondary text-xs leading-relaxed">
                    Tab switching tracked
                  </span>
                </div>

                {/* Autosave enabled */}
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-tertiary shrink-0 mt-0.5"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span className="text-text-secondary text-xs leading-relaxed">
                    Autosave enabled
                  </span>
                </div>

                {/* Stable internet recommended */}
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-tertiary shrink-0 mt-0.5"
                  >
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                  <span className="text-text-secondary text-xs leading-relaxed">
                    Stable internet recommended
                  </span>
                </div>
              </div>
            </div>

            {/* Terms of Service Section */}
            <div className="text-center select-none mb-4">
              <p className="text-text-tertiary text-xs">
                By beginning, you agree to our Terms of Service.
              </p>
            </div>

            {/* Begin Button */}
            <button
              type="submit"
              disabled={!name.trim() || !email.trim() || isSubmitting}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg py-3 font-semibold transition-colors flex items-center justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed select-none"
            >
              {isSubmitting ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="animate-spin w-4 h-4 mr-2 text-white"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Setting up your assessment...
                </>
              ) : (
                "Begin Assessment →"
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary border-t border-border-default px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto select-none">
        {/* Left Section */}
        <div className="text-xs text-text-tertiary flex items-center gap-1.5">
          <span className="font-bold text-text-primary text-sm">SkillGate</span>
          <span className="text-[10px] bg-tertiary border border-border-default px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
            AI Powered Hiring
          </span>
        </div>

        {/* Center Section */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-text-tertiary">
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Privacy Policy
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Terms of Service
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Accessibility
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Security Trust Center
          </span>
        </div>

        {/* Right Section */}
        <div className="text-xs text-text-tertiary">
          &copy; 2024 SkillGate AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
