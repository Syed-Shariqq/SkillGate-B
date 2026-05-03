import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import skillGateLogo from "../assets/skillGate-logo.png";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const candidates = [
  { name: "Maya R.", role: "Frontend Systems", score: 96, status: "Qualified" },
  { name: "Jon Bell", role: "API Design", score: 89, status: "Qualified" },
  {
    name: "Elena K.",
    role: "Data Modeling",
    score: 78,
    status: "Needs review",
  },
  { name: "Noah S.", role: "Debugging", score: 58, status: "Rejected" },
];

const differentiators = [
  {
    icon: "B",
    title: "No resume bias",
    text: "Compare candidates by demonstrated work, not schools or keyword density.",
  },
  {
    icon: "=",
    title: "Standardized evaluation",
    text: "Every applicant is measured against the same job-specific rubric.",
  },
  {
    icon: "%",
    title: "Real skill signals",
    text: "See how candidates reason, write, debug, and explain decisions.",
  },
  {
    icon: "10",
    title: "Save 10+ hours per hire",
    text: "Move screening time from manual review to structured evaluation.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    audience: "For small teams",
    price: "$99",
    cadence: "/mo",
    features: [
      "3 active jobs",
      "50 assessments",
      "AI-generated questions",
      "Candidate ranking",
    ],
    unavailable: ["Unlimited jobs", "Advanced AI evaluation"],
    cta: "Start Hiring",
  },
  {
    name: "Growth",
    audience: "Most popular",
    price: "$249",
    cadence: "/mo",
    features: [
      "Unlimited jobs",
      "AI evaluation",
      "Structured scorecards",
      "Team review workspace",
    ],
    unavailable: ["Dedicated onboarding"],
    cta: "Start Hiring",
    highlighted: true,
  },
  {
    name: "Enterprise",
    audience: "For larger hiring teams",
    price: "Custom",
    cadence: "",
    features: [
      "Custom rubrics",
      "Priority support",
      "Security review",
      "Dedicated onboarding",
    ],
    unavailable: [],
    cta: "Contact Sales",
  },
];

const faqs = [
  {
    question: "Do candidates need accounts?",
    answer:
      "No. Candidates open a secure assessment link, complete the test, and submit. No login, profile setup, or portal required.",
  },
  {
    question: "How accurate is AI scoring?",
    answer:
      "SkillGate combines rubric-based scoring with AI reasoning so recruiters can inspect why a candidate was ranked, not just the final number.",
  },
  {
    question: "Can I customize questions?",
    answer:
      "Yes. Recruiters can adjust the generated assessment, tune difficulty, and align questions to the exact role before sending links.",
  },
];

const Section = ({ id, tone = "primary", children, className = "" }) => (
  <section id={id} className={`bg-${tone} px-6 py-24 md:py-32 ${className}`}>
    <FadeIn className="mx-auto max-w-7xl">{children}</FadeIn>
  </section>
);

const FadeIn = ({ children, className = "" }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {children}
    </div>
  );
};

const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const variants = {
    primary:
      "bg-accent text-white shadow-[0_0_28px_rgba(91,109,246,0.22)] hover:bg-accent-hover hover:shadow-[0_0_34px_rgba(91,109,246,0.36)]",
    secondary:
      "border border-border-default bg-secondary text-text-primary hover:border-accent/50 hover:bg-tertiary",
    inverse:
      "bg-text-primary text-primary shadow-[0_0_30px_rgba(230,237,243,0.15)] hover:bg-white",
  };

  return (
    <Link
      className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-current transition-all duration-200 hover:scale-[1.02] ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
};

const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-lg border border-border-default bg-secondary shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34)] ${className}`}
  >
    {children}
  </div>
);

const Badge = ({ children, tone = "accent", className = "" }) => {
  const tones = {
    accent: "border-accent/25 bg-accent-soft text-text-primary",
    success: "border-success/25 bg-success/10 text-success",
    warning: "border-warning/25 bg-warning/10 text-warning",
    error: "border-error/25 bg-error/10 text-error",
    muted: "border-border-default bg-tertiary text-text-secondary",
  };

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

const scoreTone = (score) => {
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "error";
};

const statusTone = (status) => {
  if (status === "Qualified") return "success";
  if (status === "Rejected") return "error";
  return "warning";
};

const ScoreBadge = ({ score }) => (
  <Badge
    tone={scoreTone(score)}
    className="font-mono transition-transform duration-200 hover:scale-[1.04]"
  >
    {score}%
  </Badge>
);

const IncludedIcon = () => (
  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/10 text-success">
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="none">
      <path
        d="M3.5 8.2 6.6 11 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const UnavailableIcon = () => (
  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border-default bg-tertiary" />
);

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${
        scrolled
          ? "border-border-default bg-primary/82 backdrop-blur-xl"
          : "border-transparent bg-primary/40 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a
          href="#top"
          className="group flex items-center gap-3 text-text-primary"
        >
          <img
            src={skillGateLogo}
            alt="SkillGate logo"
            className="h-12 w-12 rounded-lg border border-accent/30 object-cover transition-all duration-200 group-hover:border-accent/60"
          />
          <span className="text-lg font-bold tracking-tight">SkillGate</span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {link.label}
              <span className="absolute -bottom-2 left-0 h-px w-0 bg-accent transition-all duration-200 group-hover:w-full" />
            </a>
          ))}
          <Link
            to="/auth"
            className="group relative text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Login
            <span className="absolute -bottom-2 left-0 h-px w-0 bg-accent transition-all duration-200 group-hover:w-full" />
          </Link>
          <Button to="/auth" className="px-4 py-2">
            Start Hiring
          </Button>
        </div>
      </div>
    </nav>
  );
};

const HeroMock = () => (
  <Card className="bg-secondary/95 p-4 md:p-5">
    <div className="mb-5 flex items-center justify-between border-b border-border-default pb-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">
          Candidate pipeline
        </p>
        <p className="text-xs text-text-tertiary">
          Backend Engineer assessment
        </p>
      </div>
      <Badge tone="success">Live</Badge>
    </div>

    <div className="space-y-3">
      {candidates.map((candidate) => (
        <div
          key={candidate.name}
          className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-border-default bg-primary p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/45 hover:bg-tertiary/60"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-default bg-secondary text-xs font-bold text-text-secondary">
                {candidate.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {candidate.name}
                </p>
                <p className="truncate text-xs text-text-tertiary">
                  {candidate.role}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <ScoreBadge score={candidate.score} />
            <div className="mt-1">
              <Badge
                tone={statusTone(candidate.status)}
                className="transition-transform duration-200 hover:scale-[1.04]"
              >
                {candidate.status}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5 rounded-lg border border-border-default bg-tertiary p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          Ranking reason
        </p>
        <span className="h-2 w-2 rounded-full border border-success/35 bg-success/10" />
      </div>
      <p className="text-sm leading-6 text-text-secondary">
        Maya solved the data consistency task, identified edge cases, and
        explained tradeoffs in plain language.
      </p>
    </div>
  </Card>
);

const Hero = () => (
  <section
    id="top"
    className="relative overflow-hidden bg-primary px-6 pb-24 pt-32 md:pb-32 md:pt-44"
  >
    {/* Background */}
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #5b6df6 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top left glow */}
      <div className="absolute -left-40 -top-40 h-150 w-150 rounded-full bg-accent/20 blur-[120px]" />
      {/* Bottom right glow */}
      <div className="absolute -bottom-20 right-0 h-100 w-100 rounded-full bg-accent/10 blur-[100px]" />
    </div>
    <FadeIn className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_0.82fr]">
      <div>
        <Badge>Recruiter infrastructure</Badge>
        <h1 className="mt-7 bg-linear-to-br from-text-secondary to-white bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl md:leading-[0.95]">
          Stop Screening Resumes. Start Screening Skills.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-text-secondary md:text-xl">
          Automatically evaluate candidates with real assessments - not
          keywords.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button to="/auth">Start Hiring</Button>
          <Button to="/demo" variant="secondary">
            See how it works
          </Button>
        </div>
      </div>
      <HeroMock />
    </FadeIn>
  </section>
);

const CountUp = ({ end, duration = 1200, suffix = "" }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);

    const counter = setInterval(() => {
      start += increment;
      if (start >= end) {
        setValue(end);
        clearInterval(counter);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(counter);
  }, [end, duration]);

  return (
    <span>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
};

const TrustStrip = () => {
  const stats = [
    {
      value: 2400,
      suffix: "+",
      label: "Assessments generated & evaluated",
    },
    {
      value: 94,
      suffix: "%",
      label: "Matches human recruiter decisions",
      highlight: true,
    },
    {
      value: 10,
      suffix: "h",
      label: "Saved per hire (avg screening time)",
    },
  ];

  const logos = [
    { name: "Northstar", mono: "https://t3.ftcdn.net/jpg/02/90/67/60/360_F_290676051_dVBMwaJOBDDGlSAnVOnE5YI6C5aKDgjh.jpg" },
    { name: "Aperture", mono: "https://upload.wikimedia.org/wikipedia/commons/2/23/Aperture_Science_logo_%28light_grey_background%29.png" },
    { name: "Vector", mono: "https://png.pngtree.com/element_our/png/20180926/eagle-bird-logo-vector-template.-business-logo-concept-png_113252.jpg" },
    { name: "Layer", mono: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6V4ALNSw7Cv8U8riCgJw_-QOy9sdjWtFcig&s" },
  ];

  return (
    <section className="relative border-y border-border-default bg-secondary py-24 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6">

        {/* Top label */}
        <p className="mb-16 text-center text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
          Trusted by hiring teams that prioritize real skills over resumes
        </p>

        {/* Stats */}
        <div className="flex flex-col items-center justify-center gap-10 md:flex-row md:gap-0 md:divide-x md:divide-border-default">

          {stats.map((stat, i) => (
            <div
              key={i}
              className={`group relative flex flex-col items-center gap-3 px-12 text-center transition-all duration-300`}
            >
              {/* glow effect on hover */}
              <div className="absolute inset-0 rounded-xl opacity-0 blur-xl transition group-hover:opacity-100 bg-accent/10" />

              <span
                className={`relative font-bold tracking-tight leading-none 
                ${stat.highlight
                    ? "text-6xl bg-linear-to-r from-accent to-indigo-300 bg-clip-text text-transparent"
                    : "text-5xl text-text-primary"
                  }`}
              >
                <CountUp end={stat.value} suffix={stat.suffix} />
              </span>

              <span className="relative max-w-[180px] text-sm text-text-tertiary leading-relaxed">
                {stat.label}
              </span>
            </div>
          ))}

        </div>

        {/* Divider */}
        <div className="my-16 h-px w-full bg-linear-to-r from-transparent via-border-default to-transparent" />

        {/* Logo section */}
        <div className="flex flex-wrap items-center justify-center gap-5">

          <p className="w-full text-center text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary mb-3">
            Used by early teams building smarter hiring pipelines
          </p>

        
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="group relative flex items-center gap-3 rounded-xl border border-border-default bg-primary px-8 py-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-tertiary hover:shadow-[0_10px_30px_rgba(91,109,246,0.12)]"
            >
              {/* subtle glow */}
              <div className="absolute inset-0 rounded-xl opacity-0 blur-xl transition group-hover:opacity-100 bg-accent/10" />

              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-sm font-bold text-accent">
                <img src={logo.mono} alt="logo" className="h-6 w-6 rounded-lg border border-accent/30 object-cover" />
              </span>

              <span className="relative text-base font-semibold text-text-secondary transition-all duration-200 group-hover:text-text-primary">
                {logo.name}
              </span>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      icon: "briefcase",
      number: "01",
      title: "Create Job",
      text: "Paste the role, seniority, and the skills that matter.",
    },
    {
      icon: "sparkles",
      number: "02",
      title: "AI Generates Assessment",
      text: "SkillGate turns requirements into practical questions and scoring rubrics.",
    },
    {
      icon: "link",
      number: "03",
      title: "Share Link",
      text: "Send one secure assessment link directly to your candidates.",
    },
    {
      icon: "pencil",
      number: "04",
      title: "Candidates Assessed",
      text: "Candidates complete a timed, structured test with no login required.",
    },
    {
      icon: "chart",
      number: "05",
      title: "Review Ranked Results",
      text: "Get a ranked slate of candidates with AI reasoning attached to every score.",
    },
  ];

  const iconProps = {
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    className: "h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  const icons = {
    briefcase: (
      <svg {...iconProps}>
        <path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
        <path d="M4 7h16a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1Z" />
        <path d="M3 12h18" />
        <path d="M10 12v1h4v-1" />
      </svg>
    ),
    sparkles: (
      <svg {...iconProps}>
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
        <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
        <path d="m19 13 .7 1.8 1.8.7-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7L19 13Z" />
      </svg>
    ),
    link: (
      <svg {...iconProps}>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
      </svg>
    ),
    pencil: (
      <svg {...iconProps}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
    chart: (
      <svg {...iconProps}>
        <path d="M3 3v18h18" />
        <path d="M7 15v2" />
        <path d="M11 11v6" />
        <path d="M15 7v10" />
        <path d="M19 13v4" />
      </svg>
    ),
  };

  return (
    <Section id="how-it-works" tone="primary">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          Workflow
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
          One link replaces the resume pile.
        </h2>
        <p className="mt-5 text-lg text-text-secondary">
          Create the role, send the assessment, review ranked evidence.
        </p>
      </div>

      <div className="relative mt-16">
        <div className="absolute bottom-8 left-8 top-8 w-px bg-accent/30 md:hidden" />
        <div
          className="absolute left-[10%] right-[10%] top-8 z-0 hidden h-px opacity-30 md:block"
          style={{ background: "linear-gradient(to right, #5b6df6, #5b6df6)" }}
        />

        <div className="relative z-10 grid gap-9 md:grid-cols-5 md:gap-0">
          {steps.map((step) => (
            <div
              key={step.title}
              className="relative flex items-start gap-5 md:flex-col md:items-center md:gap-0"
            >
              <div className="relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-full border border-accent/30 bg-secondary text-accent transition-all duration-200 hover:scale-105 hover:border-accent/70">
                {icons[step.icon]}
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                  {step.number}
                </span>
              </div>

              <div className="min-w-0 pt-1 md:pt-0">
                <h3 className="text-base font-bold text-text-primary md:mt-5 md:text-center">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary md:mx-auto md:max-w-[160px] md:text-center">
                  {step.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

const ProductDeepDive = () => (
  <Section
    id="product"
    tone="secondary"
    className="border-y border-border-default"
  >
    <div className="grid items-center gap-14 lg:grid-cols-2">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          Evaluation system
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
          Scores you can defend in a hiring meeting.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
          SkillGate evaluates responses against a structured rubric, explains
          the reasoning, and ranks candidates by role fit.
        </p>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {["Scoring", "AI reasoning", "Structured results"].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-border-default bg-primary p-4"
            >
              <p className="text-sm font-semibold text-text-primary">{item}</p>
              <p className="mt-2 text-xs leading-5 text-text-tertiary">
                Inspectable on every submission.
              </p>
            </div>
          ))}
        </div>
      </div>

      <Card className="bg-primary p-5">
        <div className="rounded-lg border border-border-default bg-secondary p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Candidate response
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Question 4 - debugging a failed webhook retry
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold text-success">
                92
              </p>
              <p className="text-xs text-text-tertiary">score</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border-default bg-primary p-4 font-mono text-xs leading-6 text-text-secondary transition-colors hover:border-accent/45 hover:text-text-primary">
            Adds idempotency key, separates transient failures from validation
            errors, and logs retry state before queue handoff.
          </div>

          <div className="mt-4 grid gap-3">
            {[
              [
                "Correctness",
                "Handles duplicate events and retry ordering.",
                "95%",
              ],
              [
                "Reasoning",
                "Explains why each failure path is isolated.",
                "90%",
              ],
              ["Communication", "Clear steps with minimal ambiguity.", "88%"],
            ].map(([label, detail, score]) => (
              <div
                key={label}
                className="rounded-lg border border-border-default bg-primary p-4 transition-all duration-200 hover:border-accent/45 hover:bg-tertiary"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-text-primary">
                    {label}
                  </p>
                  <Badge
                    tone={scoreTone(Number.parseInt(score, 10))}
                    className="font-mono transition-transform duration-200 hover:scale-[1.04]"
                  >
                    {score}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-text-secondary">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-success/20 bg-success/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">
              AI summary
            </p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Strong practical judgment. Candidate would likely handle
              production incidents with low supervision.
            </p>
          </div>
        </div>
      </Card>
    </div>
  </Section>
);

const DifferentiatorIcon = ({ title }) => {
  const sharedProps = {
    "aria-hidden": "true",
    viewBox: "0 0 20 20",
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (title === "No resume bias") {
    return (
      <svg {...sharedProps}>
        <path d="M6 2.75h5.25L15 6.5v10.75H6z" />
        <path d="M11 2.75V6.5h4" />
        <path d="M8 9h4" />
        <path d="M8 12h3" />
        <path d="M4 16 16 4" />
      </svg>
    );
  }

  if (title === "Standardized evaluation") {
    return (
      <svg {...sharedProps}>
        <path d="M4 5.5h2" />
        <path d="m3.75 10 1.15 1.15 2-2.3" />
        <path d="M4 15h2" />
        <path d="M10 5.5h6" />
        <path d="M10 10h6" />
        <path d="M10 15h6" />
      </svg>
    );
  }

  if (title === "Real skill signals") {
    return (
      <svg {...sharedProps}>
        <path d="M3.5 16.5h13" />
        <path d="M5.5 13.5v-3" />
        <path d="M10 13.5v-7" />
        <path d="M14.5 13.5v-9" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </svg>
  );
};

const Differentiation = () => (
  <Section tone="tertiary">
    <div className="mb-14 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
        No vague promises
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
        Built for signal.
      </h2>
    </div>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {differentiators.map((item) => {
        const isTimeSaving = item.title.includes("10+");

        return (
          <Card key={item.title} className="bg-secondary p-6">
            <div
              className={`grid h-10 w-10 place-items-center rounded-lg border bg-primary font-mono text-sm font-semibold ${
                isTimeSaving
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-border-default text-text-tertiary"
              }`}
            >
              <DifferentiatorIcon title={item.title} />
            </div>
            <h3 className="mt-5 text-lg font-bold text-text-primary">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {item.text}
            </p>
          </Card>
        );
      })}
    </div>
  </Section>
);

const CandidateExperience = () => (
  <Section tone="primary">
    <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          Candidate experience
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
          No login. No maze. Just the work.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
          Candidates get a simple assessment flow that respects their time and
          gives every applicant the same path to prove ability.
        </p>
      </div>

      <Card className="bg-secondary p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {["Landing", "Questions", "Submit", "Done"].map((label, index) => (
            <div
              key={label}
              className="relative rounded-lg border border-border-default bg-primary p-4 text-center"
            >
              {index < 3 && (
                <span className="absolute left-full top-1/2 z-10 hidden h-px w-4 bg-border-default sm:block" />
              )}
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-md bg-tertiary font-mono text-xs font-semibold text-accent">
                {index + 1}
              </div>
              <p className="mt-4 text-sm font-semibold text-text-primary">
                {label}
              </p>
              <p className="mt-2 text-xs leading-5 text-text-tertiary">
                {
                  ["Open link", "Answer cleanly", "One click", "Confirmed"][
                    index
                  ]
                }
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            "No candidate account",
            "Simple assessment flow",
            "Fair evaluation",
          ].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-border-default bg-primary p-4 text-sm font-medium text-text-secondary"
            >
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  </Section>
);

const Pricing = () => (
  <Section
    id="pricing"
    tone="secondary"
    className="border-y border-border-default"
  >
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
        Pricing
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
        Pay for better signal, not more review time.
      </h2>
    </div>

    <div className="mt-16 grid gap-6 lg:grid-cols-3">
      {pricingPlans.map((plan) => (
        <Card
          key={plan.name}
          className={`p-7 hover:scale-[1.015] ${
            plan.highlighted
              ? "-mt-3 border-accent/55 bg-tertiary shadow-[0_24px_80px_rgba(91,109,246,0.14)]"
              : "bg-primary"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-text-primary">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-text-tertiary">{plan.audience}</p>
            </div>
            {plan.highlighted && <Badge>Popular</Badge>}
          </div>
          <div className="mt-8 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-tight text-text-primary">
              {plan.price}
            </span>
            <span className="pb-1 text-sm text-text-tertiary">
              {plan.cadence}
            </span>
          </div>
          <div className="my-7 h-px bg-border-default" />
          <ul className="space-y-3">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-text-secondary"
              >
                <IncludedIcon />
                {feature}
              </li>
            ))}
            {plan.unavailable.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-text-tertiary/70"
              >
                <UnavailableIcon />
                <span className="line-through decoration-border-default">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
          <Button
            to="/auth"
            variant={plan.highlighted ? "primary" : "secondary"}
            className="mt-8 w-full"
          >
            {plan.cta}
          </Button>
        </Card>
      ))}
    </div>
  </Section>
);

const FAQ = () => {
  const [open, setOpen] = useState(0);

  return (
    <Section tone="primary">
      <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            FAQ
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
            Questions hiring teams ask first.
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((item, index) => {
            const active = open === index;
            return (
              <div
                key={item.question}
                className="rounded-lg border border-border-default bg-secondary"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  onClick={() => setOpen(active ? -1 : index)}
                  aria-expanded={active}
                >
                  <span className="text-base font-semibold text-text-primary">
                    {item.question}
                  </span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-default bg-primary text-text-secondary">
                    {active ? "-" : "+"}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-200 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-6 text-text-secondary">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
};

const FinalCTA = () => (
  <section className="relative overflow-hidden bg-tertiary px-6 py-24 md:py-32">
    <div className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #5b6df6 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
    </div>
    <FadeIn className="relative z-10 mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-6xl">
          Hire based on skill. Not guesswork.
        </h2>
        <div className="mt-9">
          <Button to="/auth" variant="inverse">
            Start Hiring
          </Button>
        </div>
      </div>
    </FadeIn>
  </section>
);

const Footer = () => (
  <footer className="border-t border-border-default bg-primary px-6 py-10">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <img
          src={skillGateLogo}
          alt="SkillGate logo"
          className="h-8 w-8 rounded-lg border border-accent/30 object-cover"
        />
        <span className="font-bold tracking-tight text-text-primary">
          SkillGate
        </span>
      </div>
      <div className="flex flex-wrap gap-6">
        {["Product", "Pricing", "Contact", "Terms"].map((item) => (
          <a
            key={item}
            href={item === "Pricing" ? "#pricing" : "#"}
            className="text-sm text-text-tertiary hover:text-text-primary"
          >
            {item}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

const LandingPage = () => (
  <div className="min-h-screen overflow-x-hidden bg-primary font-sans text-text-primary selection:bg-accent/30">
    <Navbar />
    <main>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <ProductDeepDive />
      <Differentiation />
      <CandidateExperience />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
