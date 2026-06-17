import { supabase } from "@/lib/supabase";

export const getJobSettings = async (jobId, uid) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id, title, company_name, description, skills,
        min_score_threshold, time_limit_minutes, is_active,
        allow_retakes, show_score_to_candidate,
        assessment_link_token, link_expires_at, link_max_uses
      `)
      .eq("id", jobId)
      .eq("recruiter_id", uid)
      .maybeSingle();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateJobSettings = async (jobId, uid, updates) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("recruiter_id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const resetAssessmentLink = async (jobId, uid) => {
  try {
    const newToken = crypto.randomUUID();
    const { error } = await supabase
      .from("jobs")
      .update({
        assessment_link_token: newToken,
        link_use_count: 0,
      })
      .eq("id", jobId)
      .eq("recruiter_id", uid);

    if (error) {
      return { data: null, error };
    }

    return { data: { assessment_link_token: newToken }, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const deactivateJob = async (jobId, uid) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .update({ is_active: false })
      .eq("id", jobId)
      .eq("recruiter_id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteJob = async (jobId, uid) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("recruiter_id", uid);

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
