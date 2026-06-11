import { useAuth } from "../../../hooks/useAuth";
import OnboardingChecklist from "../../../components/recruiter/OnboardingChecklist";
import JobCard from "../../../components/recruiter/JobCard";

const RecruiterDashboard = () => {
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <OnboardingChecklist />
      <JobCard
        id="test-123"
        title="Senior React Developer"
        companyName="SkillGate"
        status="active"
        candidateCount={42}
        avgScore={81}
        passRate={67}
        linkUsageCurrent={23}
        linkUsageMax={100}
        createdAt={new Date().toISOString()}
      />

      <button className="text-white" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

export default RecruiterDashboard;
