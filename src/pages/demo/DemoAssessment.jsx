import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

const TOTAL_SECONDS = 8 * 60;

const questionBank = {
  frontend: [
    {
      id: "fe-1",
      type: "mcq",
      prompt: "A React search page re-renders hundreds of rows on each keystroke. What is the best first fix?",
      options: [
        "Move every row into local state",
        "Memoize row rendering and debounce the query update",
        "Replace React with direct DOM updates",
        "Store the search text in localStorage",
      ],
      correctAnswer: "Memoize row rendering and debounce the query update",
    },
    {
      id: "fe-2",
      type: "mcq",
      prompt: "Which accessibility issue is most serious in a custom dropdown?",
      options: [
        "It uses CSS transitions",
        "It does not expose role, focus management, or keyboard navigation",
        "It has fewer than five options",
        "It uses a border instead of a shadow",
      ],
      correctAnswer: "It does not expose role, focus management, or keyboard navigation",
    },
    {
      id: "fe-3",
      type: "text",
      prompt: "Explain how you would design client-side state for a dashboard with filters, cached server data, and optimistic updates.",
      expectedKeywords: ["server state", "cache", "optimistic", "rollback", "filters", "query key", "normalization"],
    },
    {
      id: "fe-4",
      type: "text",
      prompt: "A page has poor Core Web Vitals after adding a large chart. What would you inspect and change first?",
      expectedKeywords: ["bundle", "lazy load", "memoization", "render", "layout shift", "web vitals", "profiling"],
    },
    {
      id: "fe-5",
      type: "text",
      prompt: "Describe how you would make a multi-step form resilient to refreshes, validation errors, and partial submission failures.",
      expectedKeywords: ["validation", "persistence", "draft", "retry", "idempotency", "error state", "progressive"],
    },
  ],
  backend: [
    {
      id: "be-1",
      type: "mcq",
      prompt: "A payment webhook may be delivered multiple times. What should the API guarantee?",
      options: ["Low latency only", "Idempotent processing", "Client-side retries only", "A larger request body limit"],
      correctAnswer: "Idempotent processing",
    },
    {
      id: "be-2",
      type: "mcq",
      prompt: "Which database change is safest for a high-traffic table?",
      options: [
        "Add a required column without a default during peak traffic",
        "Backfill in batches and deploy constraints after validation",
        "Lock the table and rewrite all rows immediately",
        "Drop old indexes before measuring query plans",
      ],
      correctAnswer: "Backfill in batches and deploy constraints after validation",
    },
    {
      id: "be-3",
      type: "text",
      prompt: "Design an API endpoint for creating orders that prevents duplicate charges and handles retries safely.",
      expectedKeywords: ["idempotency", "transaction", "unique constraint", "retry", "status", "webhook", "atomic"],
    },
    {
      id: "be-4",
      type: "text",
      prompt: "A queue worker is falling behind. Explain how you would diagnose and stabilize the system.",
      expectedKeywords: ["throughput", "latency", "dead letter", "backpressure", "batching", "metrics", "scaling"],
    },
    {
      id: "be-5",
      type: "text",
      prompt: "How would you model permissions for teams, roles, and project-level access without making queries brittle?",
      expectedKeywords: ["rbac", "roles", "permissions", "join table", "indexes", "scope", "audit"],
    },
  ],
  data: [
    {
      id: "da-1",
      type: "mcq",
      prompt: "A conversion rate drops after a tracking change. What should you verify first?",
      options: ["Change the chart color", "Event definitions and instrumentation coverage", "Only look at total revenue", "Delete outliers immediately"],
      correctAnswer: "Event definitions and instrumentation coverage",
    },
    {
      id: "da-2",
      type: "mcq",
      prompt: "Which metric best detects whether activation improved for new users?",
      options: ["Total users all time", "New-user cohort activation rate", "Average company age", "Highest single-day signups"],
      correctAnswer: "New-user cohort activation rate",
    },
    {
      id: "da-3",
      type: "text",
      prompt: "Write the reasoning for a SQL query that finds weekly retention by signup cohort.",
      expectedKeywords: ["cohort", "signup", "week", "retention", "join", "distinct", "date_trunc"],
    },
    {
      id: "da-4",
      type: "text",
      prompt: "A/B test results show higher clicks but lower paid conversion. How would you analyze the launch decision?",
      expectedKeywords: ["statistical significance", "conversion", "segment", "funnel", "sample size", "guardrail", "tradeoff"],
    },
    {
      id: "da-5",
      type: "text",
      prompt: "How would you build a reliable executive dashboard for pipeline health across multiple data sources?",
      expectedKeywords: ["source of truth", "freshness", "data quality", "definitions", "lineage", "validation", "sla"],
    },
  ],
};

const roleLabels = {
  frontend: "Frontend Engineer",
  backend: "Backend Engineer",
  data: "Data Analyst",
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");

const scoreAssessment = ({ questions, answers, role, startedAt }) => {
  const breakdown = questions.map((question, index) => {
    const answer = answers[question.id] || "";

    if (question.type === "mcq") {
      const correct = answer === question.correctAnswer;
      return {
        id: question.id,
        question: question.prompt,
        type: question.type,
        answered: Boolean(answer),
        score: correct ? 20 : 0,
        matchedKeywords: [],
        expectedKeywords: [],
        correct,
        answer,
        index: index + 1,
      };
    }

    const normalizedAnswer = normalize(answer);
    const matchedKeywords = question.expectedKeywords.filter((keyword) => normalizedAnswer.includes(normalize(keyword)));
    const score = Math.round((matchedKeywords.length / question.expectedKeywords.length) * 20);

    return {
      id: question.id,
      question: question.prompt,
      type: question.type,
      answered: answer.trim().length > 0,
      score,
      matchedKeywords,
      expectedKeywords: question.expectedKeywords,
      answer,
      index: index + 1,
    };
  });

  const score = Math.min(100, breakdown.reduce((total, item) => total + item.score, 0));
  const strongItems = breakdown.filter((item) => item.score >= 15);
  const weakItems = breakdown.filter((item) => item.score < 12);
  const strengths = strongItems.length
    ? strongItems.slice(0, 3).map((item) => {
        if (item.type === "mcq") return "accurate decision-making on applied scenarios";
        return item.matchedKeywords.slice(0, 2).join(" and ") || "structured technical reasoning";
      })
    : ["baseline familiarity with the role"];
  const weaknesses = weakItems.length
    ? weakItems.slice(0, 3).map((item) => {
        if (item.type === "mcq") return "scenario judgment under constraints";
        const missed = item.expectedKeywords.filter((keyword) => !item.matchedKeywords.includes(keyword));
        return missed.slice(0, 2).join(" and ") || "deeper explanation";
      })
    : ["more evidence in written explanations"];

  return {
    score,
    role,
    strengths: [...new Set(strengths)],
    weaknesses: [...new Set(weaknesses)],
    questionBreakdown: breakdown,
    timeTaken: TOTAL_SECONDS - Math.max(0, Math.round((startedAt + TOTAL_SECONDS * 1000 - Date.now()) / 1000)),
  };
};

export const ProgressDots = ({ total, current }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: total }).map((_, index) => (
      <span
        key={index}
        className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${
          index <= current ? "w-7 bg-accent" : "bg-tertiary"
        }`}
      />
    ))}
  </div>
);

export const QuestionView = ({ question, value, onChange }) => {
  if (question.type === "mcq") {
    return (
      <div className="space-y-3">
        {question.options.map((option) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm leading-6 transition-all duration-200 ${
                selected ? "border-accent bg-accent-soft text-text-primary" : "border-border-default bg-primary text-text-secondary hover:border-accent/45"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={selected}
                onChange={() => onChange(option)}
                className="h-4 w-4 accent-accent"
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={9}
        className="w-full resize-none rounded-lg border border-border-default bg-primary px-4 py-3 text-sm leading-7 text-text-primary outline-none transition-all duration-200 placeholder:text-text-tertiary focus:border-accent focus:ring-focus"
        placeholder="Write a concise but specific answer. Mention tradeoffs, constraints, and implementation details."
      />
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={value.trim().length >= 50 ? "text-success" : "text-warning"}>Minimum 50 characters to proceed</span>
        <span className="font-mono text-text-tertiary">{value.length} chars</span>
      </div>
    </div>
  );
};

const DemoAssessment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const role = location.state?.role;
  const roleId = role?.id;
  const questions = useMemo(() => questionBank[roleId] || [], [roleId]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submit = useCallback(() => {
    if (!role || submittedRef.current) return;
    submittedRef.current = true;
    const evaluation = scoreAssessment({
      questions,
      answers: answersRef.current,
      role,
      startedAt,
    });
    navigate("/demo/result", { replace: true, state: { evaluation: { ...evaluation, tabSwitches } } });
  }, [navigate, questions, role, startedAt, tabSwitches]);

  useEffect(() => {
    if (!role) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          submit();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [role, submit]);

  useEffect(() => {
    if (!role) return undefined;
    const onVisibilityChange = () => {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((count) => count + 1);
        toast.error("Tab switch detected. It will be included in the demo log.", { id: "tab-switch" });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [role]);

  useEffect(() => {
    if (!role) return undefined;
    window.history.pushState({ skillGateAssessment: true }, "", window.location.href);
    const blockBack = () => {
      if (!submittedRef.current) {
        window.history.pushState({ skillGateAssessment: true }, "", window.location.href);
        toast("Assessment is in progress. Submit to leave this screen.", { id: "assessment-lock" });
      }
    };
    window.addEventListener("popstate", blockBack);
    return () => window.removeEventListener("popstate", blockBack);
  }, [role]);

  if (!role || !questions.length) return <Navigate to="/demo" replace />;

  const question = questions[current];
  const value = answers[question.id] || "";
  const isAnswered = question.type === "mcq" ? Boolean(value) : value.trim().length >= 50;
  const timerTone = remaining <= 30 ? "text-error" : remaining <= 120 ? "text-warning" : "text-text-primary";

  return (
    <main className="min-h-screen bg-primary px-5 py-6 text-text-primary md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b border-border-default pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">SkillGate assessment</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">{roleLabels[roleId]}</h1>
          </div>
          <div className={`font-mono text-2xl font-semibold ${timerTone}`}>{formatTime(remaining)}</div>
        </header>

        <section className="mt-8">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold text-text-secondary">Question {current + 1} of {questions.length}</p>
            <ProgressDots total={questions.length} current={current} />
          </div>

          <Card className="bg-secondary p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] md:p-8">
            <Badge variant={question.type === "mcq" ? "info" : "default"} className="mb-5">
              {question.type === "mcq" ? "Multiple choice" : "Written response"}
            </Badge>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">{question.prompt}</h2>
            <div className="mt-7">
              <QuestionView
                question={question}
                value={value}
                onChange={(nextValue) => setAnswers((prev) => ({ ...prev, [question.id]: nextValue }))}
              />
            </div>
          </Card>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((index) => Math.max(0, index - 1))}>
              Prev
            </Button>
            {current === questions.length - 1 ? (
              <Button disabled={!isAnswered} onClick={submit} className="shadow-[0_0_28px_rgba(91,109,246,0.25)]">
                Submit Assessment
              </Button>
            ) : (
              <Button disabled={!isAnswered} onClick={() => setCurrent((index) => Math.min(questions.length - 1, index + 1))}>
                Next
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default DemoAssessment;
