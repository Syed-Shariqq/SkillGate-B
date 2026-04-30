import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const candidates = [
  { name: "Maya R.", role: "Frontend Systems", score: 96, status: "Ready" },
  { name: "Jon Bell", role: "API Design", score: 91, status: "Review" },
  { name: "Elena K.", role: "Data Modeling", score: 84, status: "Passed" },
  { name: "Noah S.", role: "Debugging", score: 72, status: "Hold" },
];

const steps = [
  {
    icon: "01",
    title: "Create Job",
    text: "Paste the role, seniority, and the skills that matter.",
  },
  {
    icon: "02",
    title: "AI Generates Assessment",
    text: "SkillGate turns requirements into practical questions and scoring rubrics.",
  },
  {
    icon: "03",
    title: "Get Ranked Candidates",
    text: "Send one link and review a ranked slate with reasoning attached.",
  },
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
    features: ["3 active jobs", "50 assessments", "AI-generated questions", "Candidate ranking"],
    cta: "Start Hiring",
  },
  {
    name: "Growth",
    audience: "Most popular",
    price: "$249",
    cadence: "/mo",
    features: ["Unlimited jobs", "AI evaluation", "Structured scorecards", "Team review workspace"],
    cta: "Start Hiring",
    highlighted: true,
  },
  {
    name: "Enterprise",
    audience: "For larger hiring teams",
    price: "Custom",
    cadence: "",
    features: ["Custom rubrics", "Priority support", "Security review", "Dedicated onboarding"],
    cta: "Contact Sales",
  },
];

const faqs = [
  {
    question: "Do candidates need accounts?",
    answer: "No. Candidates open a secure assessment link, complete the test, and submit. No login, profile setup, or portal required.",
  },
  {
    question: "How accurate is AI scoring?",
    answer: "SkillGate combines rubric-based scoring with AI reasoning so recruiters can inspect why a candidate was ranked, not just the final number.",
  },
  {
    question: "Can I customize questions?",
    answer: "Yes. Recruiters can adjust the generated assessment, tune difficulty, and align questions to the exact role before sending links.",
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
      { threshold: 0.16 }
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

const Button = ({ children, variant = "primary", className = "", ...props }) => {
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

const Badge = ({ children, tone = "accent" }) => {
  const tones = {
    accent: "border-accent/25 bg-accent-soft text-text-primary",
    success: "border-success/25 bg-success/10 text-success",
    muted: "border-border-default bg-tertiary text-text-secondary",
  };

  return (
    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}>
      {children}
    </span>
  );
};

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
        scrolled ? "border-border-default bg-primary/82 backdrop-blur-xl" : "border-transparent bg-primary/40 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#top" className="group flex items-center gap-3 text-text-primary">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent-soft text-sm font-bold text-accent transition-all duration-200 group-hover:border-accent/60">
            S
          </span>
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
        <p className="text-sm font-semibold text-text-primary">Candidate pipeline</p>
        <p className="text-xs text-text-tertiary">Backend Engineer assessment</p>
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
                <p className="truncate text-sm font-semibold text-text-primary">{candidate.name}</p>
                <p className="truncate text-xs text-text-tertiary">{candidate.role}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-accent">{candidate.score}%</p>
            <p className="text-[11px] font-medium text-text-tertiary">{candidate.status}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5 rounded-lg border border-border-default bg-tertiary p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Ranking reason</p>
        <span className="h-2 w-2 rounded-full bg-success" />
      </div>
      <p className="text-sm leading-6 text-text-secondary">
        Maya solved the data consistency task, identified edge cases, and explained tradeoffs in plain language.
      </p>
    </div>
  </Card>
);

const Hero = () => (
  <section id="top" className="bg-primary px-6 pb-24 pt-32 md:pb-32 md:pt-44">
    <FadeIn className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_0.82fr]">
      <div>
        <Badge>Recruiter infrastructure</Badge>
        <h1 className="mt-7 bg-linear-to-br from-text-secondary to-white bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl md:leading-[0.95]">
          Stop Screening Resumes. Start Screening Skills.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-text-secondary md:text-xl">
          Automatically evaluate candidates with real assessments - not keywords.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button to="/auth">Start Hiring</Button>
          <Button to="#how-it-works" variant="secondary">
            See how it works
          </Button>
        </div>
      </div>
      <HeroMock />
    </FadeIn>
  </section>
);

const TrustStrip = () => (
  <Section tone="secondary" className="border-y border-border-default py-16 md:py-16">
    <div className="grid items-center gap-8 md:grid-cols-[0.85fr_1.15fr]">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        Used by teams that hire for skill, not keywords
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["Northstar", "Aperture", "Vector", "Layer"].map((logo) => (
          <div
            key={logo}
            className="rounded-lg border border-border-default bg-primary px-5 py-4 text-center text-sm font-semibold text-text-tertiary transition-colors hover:text-text-primary"
          >
            {logo}
          </div>
        ))}
      </div>
    </div>
  </Section>
);

const HowItWorks = () => (
  <Section id="how-it-works" tone="primary">
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Workflow</p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">One link replaces the resume pile.</h2>
      <p className="mt-5 text-lg text-text-secondary">Create the role, send the assessment, review ranked evidence.</p>
    </div>

    <div className="relative mt-16 grid gap-5 md:grid-cols-3">
      <div className="absolute left-[16%] right-[16%] top-9 hidden h-px bg-border-default md:block" />
      {steps.map((step) => (
        <Card key={step.title} className="relative bg-secondary p-7 text-center">
          <div className="mx-auto grid h-18 w-18 place-items-center rounded-lg border border-accent/30 bg-primary font-mono text-sm font-semibold text-accent shadow-[0_0_26px_rgba(91,109,246,0.12)]">
            {step.icon}
          </div>
          <h3 className="mt-6 text-xl font-bold tracking-tight text-text-primary">{step.title}</h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{step.text}</p>
        </Card>
      ))}
    </div>
  </Section>
);

const ProductDeepDive = () => (
  <Section id="product" tone="secondary" className="border-y border-border-default">
    <div className="grid items-center gap-14 lg:grid-cols-2">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Evaluation system</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">Scores you can defend in a hiring meeting.</h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
          SkillGate evaluates responses against a structured rubric, explains the reasoning, and ranks candidates by role fit.
        </p>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {["Scoring", "AI reasoning", "Structured results"].map((item) => (
            <div key={item} className="rounded-lg border border-border-default bg-primary p-4">
              <p className="text-sm font-semibold text-text-primary">{item}</p>
              <p className="mt-2 text-xs leading-5 text-text-tertiary">Inspectable on every submission.</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="bg-primary p-5">
        <div className="rounded-lg border border-border-default bg-secondary p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Candidate response</p>
              <p className="mt-1 text-xs text-text-tertiary">Question 4 - debugging a failed webhook retry</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold text-accent">92</p>
              <p className="text-xs text-text-tertiary">score</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border-default bg-primary p-4 font-mono text-xs leading-6 text-text-secondary transition-colors hover:border-accent/45 hover:text-text-primary">
            Adds idempotency key, separates transient failures from validation errors, and logs retry state before queue handoff.
          </div>

          <div className="mt-4 grid gap-3">
            {[
              ["Correctness", "Handles duplicate events and retry ordering.", "95%"],
              ["Reasoning", "Explains why each failure path is isolated.", "90%"],
              ["Communication", "Clear steps with minimal ambiguity.", "88%"],
            ].map(([label, detail, score]) => (
              <div
                key={label}
                className="rounded-lg border border-border-default bg-primary p-4 transition-all duration-200 hover:border-accent/45 hover:bg-tertiary"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="font-mono text-sm text-accent">{score}</p>
                </div>
                <p className="mt-2 text-sm text-text-secondary">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-success/20 bg-success/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">AI summary</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Strong practical judgment. Candidate would likely handle production incidents with low supervision.
            </p>
          </div>
        </div>
      </Card>
    </div>
  </Section>
);

const Differentiation = () => (
  <Section tone="tertiary">
    <div className="mb-14 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">No vague promises</p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">Built for signal.</h2>
    </div>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {differentiators.map((item) => (
        <Card key={item.title} className="bg-secondary p-6">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-border-default bg-primary font-mono text-sm font-semibold text-accent">
            {item.icon}
          </div>
          <h3 className="mt-5 text-lg font-bold text-text-primary">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{item.text}</p>
        </Card>
      ))}
    </div>
  </Section>
);

const CandidateExperience = () => (
  <Section tone="primary">
    <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Candidate experience</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">No login. No maze. Just the work.</h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
          Candidates get a simple assessment flow that respects their time and gives every applicant the same path to prove ability.
        </p>
      </div>

      <Card className="bg-secondary p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {["Landing", "Questions", "Submit", "Done"].map((label, index) => (
            <div key={label} className="relative rounded-lg border border-border-default bg-primary p-4 text-center">
              {index < 3 && <span className="absolute left-full top-1/2 z-10 hidden h-px w-4 bg-border-default sm:block" />}
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-md bg-tertiary font-mono text-xs font-semibold text-accent">
                {index + 1}
              </div>
              <p className="mt-4 text-sm font-semibold text-text-primary">{label}</p>
              <p className="mt-2 text-xs leading-5 text-text-tertiary">
                {["Open link", "Answer cleanly", "One click", "Confirmed"][index]}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["No candidate account", "Simple assessment flow", "Fair evaluation"].map((item) => (
            <div key={item} className="rounded-lg border border-border-default bg-primary p-4 text-sm font-medium text-text-secondary">
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  </Section>
);

const Pricing = () => (
  <Section id="pricing" tone="secondary" className="border-y border-border-default">
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Pricing</p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">Pay for better signal, not more review time.</h2>
    </div>

    <div className="mt-16 grid gap-6 lg:grid-cols-3">
      {pricingPlans.map((plan) => (
        <Card
          key={plan.name}
          className={`p-7 hover:scale-[1.015] ${
            plan.highlighted ? "-mt-3 border-accent/55 bg-tertiary shadow-[0_24px_80px_rgba(91,109,246,0.14)]" : "bg-primary"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-text-primary">{plan.name}</h3>
              <p className="mt-1 text-sm text-text-tertiary">{plan.audience}</p>
            </div>
            {plan.highlighted && <Badge>Popular</Badge>}
          </div>
          <div className="mt-8 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-tight text-text-primary">{plan.price}</span>
            <span className="pb-1 text-sm text-text-tertiary">{plan.cadence}</span>
          </div>
          <div className="my-7 h-px bg-border-default" />
          <ul className="space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/15 text-[10px] text-success">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <Button to="/auth" variant={plan.highlighted ? "primary" : "secondary"} className="mt-8 w-full">
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
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">FAQ</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">Questions hiring teams ask first.</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((item, index) => {
            const active = open === index;
            return (
              <div key={item.question} className="rounded-lg border border-border-default bg-secondary">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  onClick={() => setOpen(active ? -1 : index)}
                  aria-expanded={active}
                >
                  <span className="text-base font-semibold text-text-primary">{item.question}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-default bg-primary text-text-secondary">
                    {active ? "-" : "+"}
                  </span>
                </button>
                <div className={`grid transition-all duration-200 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-6 text-text-secondary">{item.answer}</p>
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
  <Section tone="tertiary">
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-6xl">Hire based on skill. Not guesswork.</h2>
      <div className="mt-9">
        <Button to="/auth" variant="inverse">
          Start Hiring
        </Button>
      </div>
    </div>
  </Section>
);

const Footer = () => (
  <footer className="border-t border-border-default bg-primary px-6 py-10">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent-soft text-sm font-bold text-accent">
          S
        </span>
        <span className="font-bold tracking-tight text-text-primary">SkillGate</span>
      </div>
      <div className="flex flex-wrap gap-6">
        {["Product", "Pricing", "Contact", "Terms"].map((item) => (
          <a key={item} href={item === "Pricing" ? "#pricing" : "#"} className="text-sm text-text-tertiary hover:text-text-primary">
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
