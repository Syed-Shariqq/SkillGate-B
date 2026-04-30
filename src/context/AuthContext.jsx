import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import {
  getCurrentUser,
  getProfile,
  login as loginService,
  logout as logoutService,
  register as registerService,
  updateCompanyDetails as updateCompanyDetailsService,
} from "../services/auth/authService";

const AuthContext = createContext();

const loadUserAndProfile = async () => {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { user: null, profile: null };
  }

  const { data: profileData, error } = await getProfile(currentUser.id);

  return {
    user: currentUser,
    profile: error || !profileData ? null : profileData,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Session fetch error:", error);
      }

      if (!isMounted) return;

      if (data.session) {
        const authState = await loadUserAndProfile();

        if (!isMounted) return;

        setUser(authState.user);
        setProfile(authState.profile);
      } else {
        setUser(null);
        setProfile(null);
      }

      initializedRef.current = true;
      setLoading(false);
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!initializedRef.current) return;

      if (event === "SIGNED_IN") {
        const authState = await loadUserAndProfile();

        if (!isMounted) return;

        setUser(authState.user);
        setProfile(authState.profile);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async ({ email, password }) => {
    const { data, error } = await loginService({ email, password });

    if (!error) {
      const authState = await loadUserAndProfile();

      setUser(authState.user);
      setProfile(authState.profile);
    }

    return { data, error };
  };

  const register = ({ name, email, password }) => {
    return registerService({ name, email, password });
  };

  const logout = async () => {
    const { error } = await logoutService();

    setUser(null);
    setProfile(null);

    return { error };
  };

  const updateCompanyDetails = async (
    userId,
    { company_name, company_website, work_email },
  ) => {
    const { data, error } = await updateCompanyDetailsService(userId, {
      company_name,
      company_website,
      work_email,
    });

    if (!error && data) {
      setProfile(data);
    }

    return { data, error };
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      isOnboarded: !!profile?.is_onboarded,
      login,
      register,
      logout,
      updateCompanyDetails,
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
