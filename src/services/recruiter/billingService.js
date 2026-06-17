import { supabase } from "@/lib/supabase";

export const getBillingInfo = async (uid) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_tier, assessments_used, assessments_limit, billing_cycle_reset_at, stripe_customer_id")
      .eq("id", uid)
      .maybeSingle();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
