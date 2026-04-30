import { useNavigate } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";

const demoRoles = [
  {
    id: "frontend",
    title: "Frontend Engineer",
    icon: "⚛️",
    bullets: ["React state architecture", "Accessibility tradeoffs", "Performance debugging"],
  },
  {
    id: "backend",
    title: "Backend Engineer",
    icon: "⚙️",
    bullets: ["API consistency", "Data modeling", "Failure handling"],
  },
  {
    id: "data",
    title: "Data Analyst",
    icon: "📊",
    bullets: ["SQL reasoning", "Metric design", "Experiment analysis"],
  },
];

export const RoleCard = ({ role, onSelect }) => (
  <Card
    hoverable
    onClick={() => onSelect(role)}
    className="group min-h-70 bg-secondary/80 p-7 shadow-[0_20px_70px_rgba(0,0,0,0.22)] hover:border-accent/70 hover:bg-secondary hover:shadow-[0_0_0_1px_rgba(91,109,246,0.18),0_24px_80px_rgba(91,109,246,0.12)]"
  >
    <div className="flex h-full flex-col">
      <div className="grid h-14 w-14 place-items-center rounded-xl border border-border-default bg-primary text-3xl transition-all duration-200 group-hover:border-accent/50 group-hover:bg-accent-soft">
        {role.icon}
      </div>
      <h2 className="mt-7 text-2xl font-bold tracking-tight text-text-primary">{role.title}</h2>
      <ul className="mt-6 space-y-3">
        {role.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80" />
            {bullet}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8 text-sm font-semibold text-accent opacity-80 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">
        Start demo assessment
      </div>
    </div>
  </Card>
);

const DemoLanding = () => {
  const navigate = useNavigate();

  const selectRole = (role) => {
    navigate("/demo/assessment", { state: { role } });
  };

  return (
    <main className="min-h-screen bg-primary px-6 py-16 text-text-primary">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-7xl flex-col items-center justify-center">
        <Badge variant="info" className="px-3 py-1">
          Live Demo · No signup required
        </Badge>
        <div className="mt-7 max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Experience SkillGate in 2 minutes</h1>
          <p className="mt-5 text-lg leading-8 text-text-secondary md:text-xl">
            Pick a role. Answer 5 questions. See how our AI screens candidates.
          </p>
        </div>

        <section className="mt-14 grid w-full gap-5 md:grid-cols-3">
          {demoRoles.map((role) => (
            <RoleCard key={role.id} role={role} onSelect={selectRole} />
          ))}
        </section>
      </div>
      <div className="flex items-center justify-center">
        <button onClick={() => navigate("/")} className="rounded-md  bg-accent px-4 py-2 text-white hover:bg-accent/80">
          Go Back
        </button>
      </div>
    </main>
  );
};

export default DemoLanding;
