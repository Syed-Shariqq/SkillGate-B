import { supabase } from "@/lib/supabase";

export const generateToken = () => crypto.randomUUID();

export const saveJob = async (uid, jobData) => {
  try {
    const {
      title,
      company_name,
      description,
      skills,
      min_score_threshold,
      link_expires_at,
      link_max_uses,
      assessment_link_token,
    } = jobData;

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        recruiter_id: uid,
        title,
        company_name,
        description,
        skills,
        min_score_threshold,
        link_expires_at: link_expires_at || null,
        link_max_uses: link_max_uses || null,
        assessment_link_token,
        is_active: true,
        time_limit_minutes: 30,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};
