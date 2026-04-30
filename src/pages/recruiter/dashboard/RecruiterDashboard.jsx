import { useAuth } from "../../../hooks/useAuth";

const RecruiterDashboard = () => {

  const { logout } = useAuth();


  return (
  <div><button className="text-white" onClick={logout}>Logout</button></div>
);
};

export default RecruiterDashboard;
