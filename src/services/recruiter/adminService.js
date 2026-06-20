import { supabase } from "@/lib/supabase";

export const getPendingAccounts = async () => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, company_name, company_website, work_email, created_at")
      .eq("account_status", "pending_approval")
      .order("created_at", { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const approveAccount = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ account_status: "approved" })
      .eq("id", profileId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const rejectAccount = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ account_status: "rejected" })
      .eq("id", profileId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
