import { useAuth } from "../../../hooks/useAuth";
import OnboardingChecklist from "../../../components/recruiter/OnboardingChecklist";

const RecruiterDashboard = () => {
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <OnboardingChecklist />

      <button className="text-white" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

export default RecruiterDashboard;
