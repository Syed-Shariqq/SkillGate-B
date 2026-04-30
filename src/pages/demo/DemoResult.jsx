import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";

const phaseSteps = ["Parsing responses...", "Extracting concepts...", "Scoring against benchmarks...", "Generating report..."];

const followUpQuestions = {
  frontend: "How would you prevent unnecessary re-renders in a table with filters, sorting, and live updates?",
  backend: "How would you make a webhook processor idempotent while preserving an audit trail?",
  data: "How would you validate that a retention dashboard has consistent definitions across sources?",
};

const weaknessTips = {
  "scenario judgment under constraints": "Practice explaining why one implementation is safer under production constraints.",
  "deeper explanation": "Use a structure: problem, tradeoff, implementation, failure mode, measurement.",
  idempotency: "Review idempotency keys, unique constraints, retry windows, and duplicate event handling.",
  transaction: "Study transaction boundaries, isolation levels, and rollback behavior.",
  cache: "Practice separating server state, UI state, cache invalidation, and optimistic rollback.",
  "statistical significance": "Review confidence intervals, sample size, p-values, and guardrail metrics.",
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const getDecision = (score) => {
  if (score >= 70) return { label: "Shortlisted", variant: "success" };
  if (score >= 40) return { label: "Needs Review", variant: "warning" };
  return { label: "Not Qualified", variant: "error" };
};

const buildSummary = (evaluation) => {
  if (evaluation.score >= 70) {
    return `This candidate shows strong evidence for ${evaluation.role.title}, especially around ${evaluation.strengths.join(", ")}. The remaining gaps are narrow enough for a targeted follow-up interview.`;
  }
  if (evaluation.score >= 40) {
    return `This candidate has partial signal for ${evaluation.role.title}, with useful strengths in ${evaluation.strengths.join(", ")}. SkillGate would recommend a human review focused on ${evaluation.weaknesses.join(", ")}.`;
  }
  return `This candidate did not provide enough evidence for ${evaluation.role.title}. The main gaps are ${evaluation.weaknesses.join(", ")}, so SkillGate would not prioritize them for the next round.`;
};

const getStudyTips = (weaknesses) =>
  weaknesses.map((weakness) => {
    const key = Object.keys(weaknessTips).find((item) => weakness.includes(item));
    return key ? weaknessTips[key] : `Prepare a deeper example that covers ${weakness}, including tradeoffs and validation.`;
  });

export const ProcessingCard = ({ visibleSteps }) => (
  <Card className="bg-secondary p-6">
    <div className="mb-5 flex items-center gap-3">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
      <p className="font-mono text-sm text-text-secondary">skillgate-eval --demo</p>
    </div>
    <div className="space-y-3 font-mono text-sm">
      {phaseSteps.slice(0, visibleSteps).map((step) => (
        <p key={step} className="text-text-primary">
          <span className="text-accent">$</span> {step}
        </p>
      ))}
    </div>
  </Card>
);

export const ScoreRing = ({ score }) => {
  const [animated, setAnimated] = useState(false);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle cx="70" cy="70" r={radius} stroke="currentColor" strokeWidth="10" className="text-tertiary" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          className={score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-error"}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? circumference - (score / 100) * circumference : circumference}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-4xl font-bold text-text-primary">{score}</p>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">score</p>
      </div>
    </div>
  );
};

export const ChatPanel = ({ evaluation }) => {
  const [messages, setMessages] = useState(() => {
    const first =
      evaluation.score >= 70
        ? "This candidate is above the shortlist threshold. Ask me about strengths, weaknesses, or a follow-up question."
        : evaluation.score >= 40
          ? "This result needs review. I can explain the score, gaps, or how the candidate could improve."
          : "This was a low-confidence submission. I can show why the score was low and what skills were missing.";
    return [{ sender: "ai", text: first }];
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const replyTo = (text) => {
    const query = text.toLowerCase();
    if (query.includes("why") || query.includes("low score")) {
      return `The score is mainly driven by gaps in ${evaluation.weaknesses.join(", ")}. Written answers also need more explicit implementation detail to earn full rubric credit.`;
    }
    if (query.includes("improve") || query.includes("study")) {
      return getStudyTips(evaluation.weaknesses).join(" ");
    }
    if (query.includes("question")) {
      return followUpQuestions[evaluation.role.id] || "Walk me through a realistic production issue and how you would diagnose it.";
    }
    if (query.includes("strength")) {
      return `Strongest signals: ${evaluation.strengths.join(", ")}. These answers matched the benchmark language most clearly.`;
    }
    if (query.includes("weakness") || query.includes("gap")) {
      return `Primary gaps: ${evaluation.weaknesses.join(", ")}. I would probe these before making a hiring decision.`;
    }
    return `For this ${evaluation.role.title} screen, I would focus the next review on ${evaluation.weaknesses[0]} and validate ${evaluation.strengths[0]}.`;
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { sender: "user", text }, { sender: "ai", text: replyTo(text) }]);
    setInput("");
  };

  return (
    <Card className="animate-fade-in-up bg-secondary p-5">
      <h3 className="text-lg font-bold tracking-tight">Ask SkillGate AI</h3>
      <div ref={scrollRef} className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-2">
        {messages.map((message, index) => (
          <div key={`${message.sender}-${index}`} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6 ${
                message.sender === "user"
                  ? "border-accent/30 bg-accent-soft text-text-primary"
                  : "border-border-default bg-primary text-text-secondary"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder="Ask why low score, how to improve, strengths..."
        />
        <Button onClick={send}>Send</Button>
      </div>
    </Card>
  );
};

const DemoResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const evaluation = location.state?.evaluation;
  const [phase, setPhase] = useState("thinking");
  const [visibleSteps, setVisibleSteps] = useState(1);
  const [traceCount, setTraceCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const traceLines = useMemo(() => {
    if (!evaluation) return [];
    return [
      ...evaluation.strengths.slice(0, 2).map((item) => ({ tone: "success", text: `Strong understanding of ${item}` })),
      ...evaluation.weaknesses.slice(0, 2).map((item) => ({ tone: "error", text: `Limited explanation of ${item}` })),
    ];
  }, [evaluation]);

  useEffect(() => {
    const stepTimer = window.setInterval(() => setVisibleSteps((count) => Math.min(phaseSteps.length, count + 1)), 800);
    const phaseTimer = window.setTimeout(() => setPhase("evaluating"), 3500);
    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(phaseTimer);
    };
  }, []);

  useEffect(() => {
    if (phase !== "evaluating") return undefined;
    const traceTimer = window.setInterval(() => {
      setTraceCount((count) => {
        if (count >= traceLines.length) {
          window.clearInterval(traceTimer);
          window.setTimeout(() => setPhase("result"), 500);
          return count;
        }
        return count + 1;
      });
    }, 700);
    return () => window.clearInterval(traceTimer);
  }, [phase, traceLines.length]);

  useEffect(() => {
    if (phase === "result") {
      const timer = window.setTimeout(() => setChatOpen(true), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  if (!evaluation) return <Navigate to="/demo" replace />;

  const decision = getDecision(evaluation.score);
  const answered = evaluation.questionBreakdown.filter((item) => item.answered).length;
  const keywordsMatched = evaluation.questionBreakdown.reduce((total, item) => total + item.matchedKeywords.length, 0);

  return (
    <main className="min-h-screen bg-primary px-5 py-10 text-text-primary md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Badge variant="info">SkillGate demo report</Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{evaluation.role.title} Evaluation</h1>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate("/demo")}>Try Another Role</Button>
            <Button onClick={() => navigate("/auth")} className="shadow-[0_0_28px_rgba(91,109,246,0.25)]">
              Start Hiring Smarter
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <ProcessingCard visibleSteps={visibleSteps} />
            {(phase === "evaluating" || phase === "result") && (
              <Card className="bg-secondary p-6">
                <h2 className="text-lg font-bold tracking-tight">Evaluation trace</h2>
                <div className="mt-4 space-y-3">
                  {traceLines.slice(0, traceCount).map((line) => (
                    <div key={line.text} className="flex items-start gap-3 text-sm leading-6">
                      <span className={line.tone === "success" ? "text-success" : "text-error"}>{line.tone === "success" ? "✓" : "✕"}</span>
                      <span className="text-text-secondary">{line.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {chatOpen && <ChatPanel evaluation={evaluation} />}
          </div>

          <Card className="min-h-155 bg-secondary p-6 md:p-8">
            {phase !== "result" ? (
              <div className="flex h-full min-h-130 items-center justify-center text-center">
                <div>
                  <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-accent/30 bg-accent-soft" />
                  <p className="mt-5 font-mono text-sm text-text-secondary">Building candidate report...</p>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in-up">
                <div className="flex flex-col items-center justify-between gap-6 border-b border-border-default pb-7 md:flex-row">
                  <ScoreRing score={evaluation.score} />
                  <div className="flex-1">
                    <Badge variant={decision.variant} className="mb-4">{decision.label}</Badge>
                    <h2 className="text-2xl font-bold tracking-tight">AI screening summary</h2>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">{buildSummary(evaluation)}</p>
                  </div>
                </div>

                <div className="mt-7 grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-text-primary">Strengths</h3>
                    <ul className="mt-3 space-y-2">
                      {evaluation.strengths.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-text-secondary">
                          <span className="text-success">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">Weaknesses</h3>
                    <ul className="mt-3 space-y-2">
                      {evaluation.weaknesses.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-text-secondary">
                          <span className="text-error">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-7 rounded-lg border border-warning/20 bg-warning/10 p-5">
                  <h3 className="font-semibold text-warning">Study suggestions</h3>
                  <ul className="mt-3 space-y-2">
                    {getStudyTips(evaluation.weaknesses).map((tip) => (
                      <li key={tip} className="flex gap-2 text-sm leading-6 text-text-secondary">
                        <span className="text-warning">→</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Questions answered", `${answered}/5`],
                    ["Keywords matched", keywordsMatched],
                    ["Time taken", formatDuration(evaluation.timeTaken)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border-default bg-primary p-4">
                      <p className="text-xs text-text-tertiary">{label}</p>
                      <p className="mt-2 font-mono text-xl font-semibold text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
};

export default DemoResult;
