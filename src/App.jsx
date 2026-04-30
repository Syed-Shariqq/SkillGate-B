import React, { useEffect } from "react";
import SkeletonCard from "./components/ui/SkeletonCard";
import { useAuth } from "./hooks/useAuth";

const App = () => {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    console.log("AUTH STATE:", { user, profile, loading });
  }, [user, profile, loading]);

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div>
      <h1>Auth Test</h1>
      <p>User: {user ? user.email : "Not logged in"}</p>
      <p>Onboarded: {profile?.is_onboarded ? "Yes" : "No"}</p>
    </div>
  );
};

export default App;