import { useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { supabase } from "../../../config/supabase";

const RecruiterDashboard = () => {
  const { logout } = useAuth();

  useEffect(() => {
  supabase.auth.refreshSession().then(({ data }) => {
    console.log(data.session.access_token)
  })
}, [])

  return (
    <div>
      <button className="text-white" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

export default RecruiterDashboard;
