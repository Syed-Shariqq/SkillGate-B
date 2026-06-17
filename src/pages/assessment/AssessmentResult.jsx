import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { getSessionFromStorage } from "@/services/assessment/assessmentService";

import { getResult } from "@/services/assessment/resultService";

import toast from "react-hot-toast";
import { supabase } from "@/config/supabase";

export default function AssessmentResult() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  // State
  const [result, setResult] = useState(null);
  const [pageStatus, setPageStatus] = useState("loading");
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [hasPurchasedPlan, setHasPurchasedPlan] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Esc Key Close Support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsRoadmapOpen(false);
      }
    };
    if (isRoadmapOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isRoadmapOpen]);

  // Derived statistics for Roadmap
  const totalDays = useMemo(() => {
    return result?.trainingPlan?.length || 0;
  }, [result]);

  const totalTasks = useMemo(() => {
    if (!result?.trainingPlan) return 0;
    return result.trainingPlan.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
  }, [result]);

  // Initialize session directly during useState setup to avoid cascading render warnings in useEffect
  const [session] = useState(() => {
    const { data } = getSessionFromStorage();
    return data;
  });

  // Refs
  const mountedRef = useRef(true);

  // Mount Flow & Data Fetching (driven by assessmentId, session, and retryCount to satisfy set-state-in-effect linter analysis)
  useEffect(() => {
    mountedRef.current = true;

    const loadData = async () => {
      setPageStatus("loading");
      try {
        const res = await getResult({
          assessmentId,
          sessionToken: session?.sessionToken,
        });
        console.log("Fetched result:", res); // Debug log for fetched result

        if (!mountedRef.current) return;

        if (res.error || !res.data) {
          setPageStatus("error");
        } else {
          setResult(res.data);
          setPageStatus("ready");
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
  }, [assessmentId, session, retryCount]);

  // Recharts Theme Colors State
  const [chartColors, setChartColors] = useState({
    stroke: "#5b6df6",
    fill: "#5b6df6",
    grid: "#e2e8f0",
    text: "#64748b",
  });

  // Dynamically resolve colors from computed CSS variables asynchronously for theme accuracy
  useEffect(() => {
    if (pageStatus === "ready") {
      const timerId = setTimeout(() => {
        if (!mountedRef.current) return;
        const style = getComputedStyle(document.documentElement);
        const accent =
          style.getPropertyValue("--color-accent").trim() || "#5b6df6";
        const border =
          style.getPropertyValue("--color-border-default").trim() || "#e2e8f0";
        const text =
          style.getPropertyValue("--color-text-secondary").trim() || "#64748b";

        setChartColors({
          stroke: accent,
          fill: accent,
          grid: border,
          text: text,
        });
      }, 0);

      return () => clearTimeout(timerId);
    }
  }, [pageStatus]);

  // Radar Competency Mapping useMemo Heuristics
  const radarData = useMemo(() => {
    const qResults = result?.questionResults || [];
    if (qResults.length === 0) return [];

    const fallbackCategories = [
      "API Design",
      "Frontend Development",
      "Problem Solving",
      "Data Structures",
      "Database Systems",
      "System Architecture",
    ];

    const grouped = {};

    qResults.forEach((q, idx) => {
      let skill = fallbackCategories[idx % fallbackCategories.length];
      const text = (q.questionText || "").toLowerCase();

      // Basic semantic skill grouping
      if (
        text.includes("react") ||
        text.includes("frontend") ||
        text.includes("html") ||
        text.includes("css") ||
        text.includes("ui") ||
        text.includes("component")
      ) {
        skill = "Frontend Development";
      } else if (
        text.includes("sql") ||
        text.includes("database") ||
        text.includes("query") ||
        text.includes("mongodb") ||
        text.includes("postgres")
      ) {
        skill = "Database Systems";
      } else if (
        text.includes("api") ||
        text.includes("rest") ||
        text.includes("http") ||
        text.includes("endpoint")
      ) {
        skill = "API Design";
      } else if (
        text.includes("algorithm") ||
        text.includes("complexity") ||
        text.includes("tree") ||
        text.includes("array") ||
        text.includes("string")
      ) {
        skill = "Problem Solving";
      }

      // Convert score to percentage safely (0 - 100)
      let scoreVal = q.score ?? 0;
      if (scoreVal <= 1 && scoreVal > 0) {
        scoreVal = scoreVal * 100;
      }
      const finalScore = Math.min(Math.max(0, Math.round(scoreVal)), 100);

      if (!grouped[skill]) {
        grouped[skill] = { sum: 0, count: 0 };
      }
      grouped[skill].sum += finalScore;
      grouped[skill].count += 1;
    });

    return Object.entries(grouped).map(([skill, data]) => ({
      skill,
      score: Math.round(data.sum / data.count),
    }));
  }, [result]);

  // Textual skill summary for screen readers & accessible comprehension
  const compactSkillsText = useMemo(() => {
    return radarData.map((item) => `${item.skill}: ${item.score}`).join(" · ");
  }, [radarData]);

  // Date Completed Formatting
  const completedDateText = useMemo(() => {
    if (!result?.completedAt) return null;
    try {
      const dateStr = new Date(result.completedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Completed on ${dateStr}`;
    } catch {
      return null;
    }
  }, [result]);

  // Score Clamping and Color Logic
  const scoreVal = useMemo(() => {
    if (result?.overallScore === null || result?.overallScore === undefined)
      return null;
    return Math.min(Math.max(0, Math.round(result.overallScore)), 100);
  }, [result]);

  const scoreColorClass = useMemo(() => {
    if (scoreVal === null) return "text-text-tertiary";
    if (scoreVal >= 70) return "text-success";
    if (scoreVal >= 50) return "text-warning";
    return "text-error";
  }, [scoreVal]);

  const isPassed = useMemo(() => {
    return scoreVal !== null && scoreVal >= 70;
  }, [scoreVal]);

  // Processing Fallback state
  const isStillProcessing = useMemo(() => {
    return (
      result?.overallScore === null &&
      !result?.feedback &&
      (!result?.questionResults || result.questionResults.length === 0)
    );
  }, [result]);

  // RLS Policy recommendation for training_purchases:
  // -- CREATE POLICY "Candidates can check their purchase"
  // -- ON training_purchases FOR SELECT USING (true);
  const checkTrainingPurchase = async () => {
    if (!assessmentId) return;
    setCheckingPurchase(true);
    try {
      const { data, error } = await supabase
        .from("training_purchases")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setHasPurchasedPlan(true);
      }
    } catch (err) {
      console.error("Error checking training purchase:", err);
    } finally {
      setCheckingPurchase(false);
    }
  };

  useEffect(() => {
    const checkPurchaseAndCleanUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isPurchasedParam = urlParams.get("training_purchased") === "true";

      // Run DB check either if candidate didn't pass OR if they just got redirected back with training_purchased=true
      if (scoreVal !== null && (scoreVal < 70 || isPurchasedParam)) {
        await checkTrainingPurchase();
      }

      // Clean the URL param if it is present
      if (isPurchasedParam) {
        urlParams.delete("training_purchased");
        const newSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    if (pageStatus === "ready") {
      checkPurchaseAndCleanUrl();
    }
  }, [assessmentId, pageStatus, scoreVal]);

  const handleBuyTrainingPlan = async () => {
    setPurchaseLoading(true);
    const paymentLink = import.meta.env.VITE_STRIPE_TRAINING_PLAN_PAYMENT_LINK;
    if (!paymentLink) {
      console.error("VITE_STRIPE_TRAINING_PLAN_PAYMENT_LINK is not defined");
      toast.error("Stripe payment link configuration is missing");
      setPurchaseLoading(false);
      return;
    }

    const currentPageUrl = window.location.href.split("?")[0];
    const checkoutUrl = `${paymentLink}?client_reference_id=${assessmentId}&success_url=${encodeURIComponent(`${currentPageUrl}?training_purchased=true`)}&cancel_url=${encodeURIComponent(currentPageUrl)}`;
    
    window.location.href = checkoutUrl;
  };

  // Accordion Toggle
  const toggleQuestion = useCallback((qId) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  }, []);

  const getPdfUrl = async () => {
    if (!result?.id) {
      toast.error("Result not found");
      return null;
    }

    if (!result?.pdfStoragePath) {
      toast("PDF is still generating");
      return null;
    }

    const { data, error } = await supabase.functions.invoke("get-pdf-url", {
      body: {
        resultId: result.id,
        sessionToken: session.sessionToken,
      },
    });

    if (error) {
      throw error;
    }

    return data?.signedUrl ?? null;
  };

  const handleViewReport = async () => {

    setFetching(true);
    try {
      const signedUrl = await getPdfUrl();

      if (!signedUrl) {
        toast.error("Unable to open report");
        return;
      }

      window.open(signedUrl, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Failed to open report");
    } finally {
      setFetching(false);
    }
  };

 const handleDownloadReport = async () => {

  setFetching(true);
  try {
    const signedUrl = await getPdfUrl();

    if (!signedUrl) {
      toast.error("Unable to download report");
      return;
    }

    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch PDF");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "skillgate-report.pdf";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error(error);
    toast.error("Failed to download report");
  } finally {
    setFetching(false);
  }
};

  // Dynamic share text & LinkedIn Action
  const handleShareLinkedIn = useCallback(() => {
    const baseUrl = "https://www.linkedin.com/sharing/share-offsite/";
    const shareUrl = "https://skillgate.app";
    const fullUrl = `${baseUrl}?url=${encodeURIComponent(shareUrl)}`;
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  }, []);

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
        <p className="text-text-secondary text-sm mt-4 font-medium select-none animate-pulse">
          Loading your results...
        </p>
      </div>
    );
  }

  // Error State
  if (pageStatus === "error") {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-secondary border border-border-default rounded-xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-error font-semibold text-xl mb-2">
            Unable to load results
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Please try again or check your email for results
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => setRetryCount((prev) => prev + 1)}
              className="bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors font-medium text-sm select-none"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="border border-border-default hover:bg-tertiary text-text-primary rounded-lg px-4 py-2 transition-colors font-medium text-sm select-none"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-20 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left Section */}
        <div className="text-sm select-none">
          <span className="font-bold text-text-primary">SkillGate</span>
          <span className="text-text-tertiary font-normal"> · Results</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
            <button
            type="button"
            onClick={handleDownloadReport}
            className="border border-border-default rounded-lg px-3 py-1.5 text-xs text-text-primary hover:bg-tertiary transition-colors font-medium select-none"
          >
            {fetching ? "Downloading..." : "Download PDF"}
          </button>

          <button
            type="button"
            onClick={handleShareLinkedIn}
            className="bg-accent text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-colors select-none"
          >
            Share Result
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="grow py-8 md:py-12">
        {/* Hero Section */}
        <section className="px-4 text-center max-w-3xl mx-auto mb-10 select-none">
          <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-2 block">
            OVERALL SCORE
          </span>

          {/* Score display */}
          <div className="flex items-end justify-center">
            <span
              className={`text-6xl md:text-7xl font-bold leading-none ${scoreColorClass}`}
            >
              {scoreVal !== null ? scoreVal : "—"}
            </span>
            {scoreVal !== null && (
              <span className="text-2xl text-text-tertiary font-mono ml-1">
                /100
              </span>
            )}
          </div>

          {/* Pass/Fail Badge */}
          {scoreVal !== null && (
            <span
              className={`font-mono text-xs uppercase px-4 py-1.5 rounded-full font-semibold mt-3 mb-4 inline-block ${
                isPassed
                  ? "bg-success/15 text-success"
                  : "bg-error/15 text-error"
              }`}
            >
              {isPassed ? "Passed" : "Failed"}
            </span>
          )}

          {/* Feedback Section */}
          <div className="mt-4 max-w-xl mx-auto">
            {isStillProcessing ? (
              <p className="text-text-secondary text-sm italic">
                Your assessment is still being processed. Results will appear
                shortly.
              </p>
            ) : (
              <p className="text-text-secondary text-base leading-relaxed">
                {result?.feedback ||
                  "Your assessment has been completed and results recorded."}
              </p>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleViewReport}
              className="border border-border-default text-text-primary rounded-lg px-4 py-2 hover:bg-tertiary transition-colors font-medium text-xs select-none"
            >
              {fetching ? "Opening..." : "View Report"}
            </button>
            <button
              type="button"
              onClick={handleShareLinkedIn}
              className="bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors font-semibold text-xs select-none"
            >
              ↗ Share on LinkedIn
            </button>
          </div>

          {/* Completed Timestamp */}
          {completedDateText && (
            <p className="text-text-tertiary text-xs font-mono mt-4 block">
              {completedDateText}
            </p>
          )}
        </section>

        {/* Competency Passport Radar Chart */}
        {radarData.length > 0 && (
          <section className="max-w-2xl mx-auto px-4 mb-8">
            <div className="bg-secondary border border-border-default rounded-2xl p-6 shadow-sm">
              <div className="mb-6 select-none">
                <h2 className="text-text-primary font-semibold text-lg mb-1">
                  AI Skill Passport
                </h2>
                <p className="text-text-secondary text-xs">
                  Competency mapping across assessed areas
                </p>
              </div>

              {/* Radar Chart responsive container */}
              <div className="w-full flex justify-center">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={radarData}
                  >
                    <PolarGrid stroke={chartColors.grid} />
                    <PolarAngleAxis
                      dataKey="skill"
                      tick={{
                        fill: chartColors.text,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke={chartColors.stroke}
                      fill={chartColors.fill}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-secondary, #1c1c1f)",
                        borderColor: "var(--color-border-default, #2d2d30)",
                        color: "var(--color-text-primary, #ffffff)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Textual Accessibility Summary */}
              <p className="text-center text-text-tertiary text-xs mt-4 font-medium select-none leading-relaxed">
                {compactSkillsText}
              </p>
            </div>
          </section>
        )}

        {/* Detailed Breakdown Accordions */}
        {result?.questionResults && result.questionResults.length > 0 && (
          <section className="max-w-2xl mx-auto px-4 mb-8">
            <h2 className="text-text-primary font-semibold text-lg mb-4 select-none">
              Question Breakdown
            </h2>

            {result.questionResults.map((q, idx) => {
              const isExpanded = expandedQuestions.has(q.questionId);
              const scoreBadge = q.score !== null ? `${q.score}/1` : "—";

              return (
                <div
                  key={q.questionId || idx}
                  className="bg-secondary border border-border-default rounded-xl mb-3 overflow-hidden shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`faq-content-${q.questionId}`}
                    onClick={() => toggleQuestion(q.questionId)}
                    className="flex items-center justify-between p-4 w-full text-left focus:outline-none hover:bg-tertiary transition-colors"
                  >
                    {/* Left Info */}
                    <div className="flex items-center min-w-0 mr-3">
                      <span className="bg-tertiary text-text-tertiary font-mono text-xs px-2 py-0.5 rounded mr-3 shrink-0 select-none">
                        Q{idx + 1}
                      </span>
                      <span className="text-text-primary text-sm font-medium truncate">
                        {q.questionText || "Assessed Question"}
                      </span>
                    </div>

                    {/* Right Badges & Chevron */}
                    <div className="flex items-center gap-3 shrink-0 select-none">
                      <span className="bg-accent/15 text-accent font-mono text-xs px-2 py-0.5 rounded">
                        {scoreBadge}
                      </span>

                      {/* Rotating Chevron inline SVG */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded AI feedback panel */}
                  {isExpanded && (
                    <div
                      id={`faq-content-${q.questionId}`}
                      className="px-4 pb-4 pt-4 border-t border-border-default bg-tertiary/10 animate-fade-in-up"
                    >
                      <h4 className="font-mono text-xs uppercase tracking-wider text-text-tertiary mb-2 font-semibold select-none">
                        AI Feedback
                      </h4>
                      {q.feedback ? (
                        <p className="text-text-secondary text-sm leading-relaxed">
                          {q.feedback}
                        </p>
                      ) : (
                        <p className="text-text-tertiary italic text-sm">
                          Feedback is being generated...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Completion Card Receipts */}
        <section className="max-w-2xl mx-auto px-4 mb-8">
          <div className="bg-secondary border border-border-default rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left Side */}
              <div className="flex gap-3 items-start sm:items-center">
                {/* Check Circle SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success shrink-0 w-8 h-8"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>

                <div>
                  <h3 className="text-text-primary font-semibold text-base leading-none">
                    Assessment Complete
                  </h3>
                  <p className="text-text-secondary text-sm mt-1">
                    Your responses have been securely recorded and shared with
                    the hiring team.
                  </p>
                </div>
              </div>

              {/* Right Side Buttons */}
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="border border-border-default text-text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-tertiary transition-colors w-full select-none"
                >
                 { fetching ? "Downloading..." : "Download PDF Receipt" }
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoadmapOpen(true)}
                  className="border border-border-default text-text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-tertiary transition-colors w-full select-none"
                >
                  Explore Growth Roadmap
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-secondary border-t border-border-default px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto select-none">
        {/* Left */}
        <div className="text-xs text-text-tertiary flex items-center gap-1.5">
          <span className="font-bold text-text-primary text-sm">SkillGate</span>
          <span className="text-[10px] bg-tertiary border border-border-default px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
            AI Powered Hiring
          </span>
        </div>

        {/* Center */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-text-tertiary">
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Privacy Policy
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Terms of Service
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Security Compliance
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            API Documentation
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Support
          </span>
        </div>

        {/* Right */}
        <div className="text-xs text-text-tertiary text-center sm:text-right">
          &copy; 2024 SkillGate AI. Precision Engineering for Talent.
        </div>
      </footer>

      {/* ROADMAP MODAL */}
      {isRoadmapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden">
          {/* Blurred dark backdrop */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsRoadmapOpen(false)}
            aria-hidden="true"
          />
          
          {/* Centered Modal Container */}
          <div 
            className="relative w-full max-w-5xl bg-secondary border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all transform scale-100 duration-300 overflow-hidden animate-fade-in-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-secondary border-b border-border-default px-6 py-4 flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-lg md:text-xl font-bold text-text-primary flex items-center gap-2">
                  <span>Growth Roadmap</span>
                  <span className="text-[10px] font-mono py-0.5 px-2 bg-accent/15 text-accent rounded-full font-medium">
                    AI Personalized
                  </span>
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Step-by-step training plan designed specifically for you
                </p>
              </div>
              
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsRoadmapOpen(false)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-tertiary rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Internal Scrollable Content */}
            <div className="overflow-y-auto grow p-6 space-y-8 scroll-smooth">
              {/* Stats Overview */}
              {result?.trainingPlan && result.trainingPlan.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-tertiary/20 border border-border-default/60 mb-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Duration</span>
                    <p className="text-sm font-bold text-text-primary">{totalDays} Days Plan</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Total Milestones</span>
                    <p className="text-sm font-bold text-text-primary">{totalTasks} Action Items</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Target Skills</span>
                    <p className="text-sm font-bold text-text-primary">Customized Growth</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Status</span>
                    <p className="text-sm font-bold text-success flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse" /> Ready to Start
                    </p>
                  </div>
                </div>
              )}

              {/* Roadmap Content */}
              {!result?.trainingPlan || result.trainingPlan.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="bg-tertiary/40 border border-border-default rounded-full p-4 mb-4">
                    <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg">Growth roadmap unavailable</h3>
                  <p className="text-text-secondary text-sm mt-1 max-w-sm">
                    Your personalized skill development plan is currently being prepared. Check back shortly.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 md:pl-10 space-y-12 pb-6">
                  {/* Vertical Progress Line */}
                  <div className="absolute left-2.75 md:left-4.75 top-4 bottom-4 w-0.5 bg-linear-to-b from-accent via-accent/40 to-border-default/20 rounded-full" />
                  
                  {checkingPurchase ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
                      <p className="text-xs text-text-secondary mt-3 font-sans">Checking training plan access...</p>
                    </div>
                  ) : (
                    <>
                      {result.trainingPlan
                        .filter((_, idx) => isPassed || hasPurchasedPlan || idx < 2)
                        .map((dayPlan, index) => (
                          <div key={dayPlan.day || index} className="relative group">
                            {/* Timeline Bullet */}
                            <div className="absolute -left-5.25 md:-left-7.25 top-1.5 z-10 flex items-center justify-center">
                              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary border-2 border-accent flex items-center justify-center text-[10px] md:text-xs font-mono font-bold text-accent shadow-lg group-hover:scale-110 transition-transform duration-200">
                                {dayPlan.day}
                              </div>
                            </div>
                            
                            {/* Day Content */}
                            <div className="space-y-4">
                              {/* Day Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="font-mono text-xs text-accent uppercase font-bold tracking-wider">
                                    DAY {dayPlan.day}
                                  </span>
                                  <h3 className="text-base md:text-lg font-bold text-text-primary mt-0.5">
                                    {dayPlan.focus}
                                  </h3>
                                </div>
                                
                                {/* Progress Pill */}
                                <div className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full bg-accent-soft text-[10px] md:text-xs font-mono text-accent font-semibold border border-accent/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                  Active Milestone
                                </div>
                              </div>
                              
                              {/* Tasks List */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dayPlan.tasks?.map((task, taskIdx) => (
                                  <div 
                                    key={taskIdx}
                                    className="group/task card-glass hover:bg-tertiary/40 border border-border-default/60 hover:border-accent/40 p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(91,109,246,0.08)] transform hover:-translate-y-0.5"
                                  >
                                    <div className="space-y-2">
                                      {/* Badges */}
                                      <div className="flex flex-wrap gap-2 items-center">
                                        {/* Duration */}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-tertiary text-[10px] md:text-xs font-mono text-text-secondary border border-border-default/60 font-medium">
                                          <svg className="w-3 h-3 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          {task.duration}
                                        </span>
                                        
                                        {/* Resource Label */}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 text-[10px] md:text-xs font-mono text-accent border border-accent/15 font-medium truncate max-w-50">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                          </svg>
                                          {task.resource}
                                        </span>
                                      </div>
                                      
                                      {/* Task Title */}
                                      <h4 className="text-sm md:text-base font-bold text-text-primary group-hover:text-accent transition-colors duration-200">
                                        {task.title}
                                      </h4>
                                      
                                      {/* Description */}
                                      <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
                                        {task.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      
                      {!isPassed && !hasPurchasedPlan && (
                        <div className="relative group pl-6 md:pl-10 mt-8">
                          {/* Timeline Bullet for locked plan */}
                          <div className="absolute -left-5.25 md:-left-7.25 top-1.5 z-10 flex items-center justify-center">
                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary border-2 border-border-default flex items-center justify-center text-[10px] md:text-xs font-mono font-bold text-text-tertiary shadow-lg">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* Locked Section Card */}
                          <div className="card-glass border border-border-default/60 p-6 md:p-8 max-w-xl mx-auto flex flex-col items-center text-center relative overflow-hidden bg-secondary/80 backdrop-blur-xs">
                            <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-4">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                            
                            <h3 className="text-lg md:text-xl font-bold text-text-primary mb-2">Days 3–7 are locked</h3>
                            <p className="text-sm text-text-secondary mb-6">Get your personalized full 7-day plan for just $9</p>
                            
                            <ul className="text-left text-xs md:text-sm text-text-secondary space-y-2 mb-6 max-w-sm">
                              <li className="flex items-start gap-2">
                                <span className="text-accent shrink-0">✓</span>
                                <span>Detailed daily tasks with resources</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-accent shrink-0">✓</span>
                                <span>Skill-specific practice exercises</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-accent shrink-0">✓</span>
                                <span>Curated learning path to pass next time</span>
                              </li>
                            </ul>
                            
                            <button
                              onClick={handleBuyTrainingPlan}
                              disabled={purchaseLoading}
                              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-lg transition-colors duration-200 cursor-pointer disabled:opacity-50"
                            >
                              {purchaseLoading ? "Processing..." : "Unlock Full Plan — $9"}
                            </button>
                            
                            <p className="text-[10px] md:text-xs text-text-tertiary mt-3">
                              One-time payment &middot; Instant access &middot; No subscription
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
