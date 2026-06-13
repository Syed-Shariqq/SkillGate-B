import { supabase } from "../lib/supabase";

export const getAllJobs = async (uid) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        company_name,
        is_active,
        created_at,
        link_max_uses,
        link_use_count,
        link_expires_at,
        assessments (
          status,
          results (
            overall_score,
            passed
          )
        )
      `)
      .eq("recruiter_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const processedData = (data || []).map((job) => {
      const completedAssessments = (job.assessments || []).filter(
        (assessment) => assessment.status === "completed"
      );

      const results = completedAssessments.flatMap((assessment) =>
        Array.isArray(assessment.results) ? assessment.results : []
      );

      const scores = results
        .map((result) => {
          const val = Number(result.overall_score);
          return Number.isFinite(val) ? val : null;
        })
        .filter((score) => score !== null);

      const avgScore =
        scores.length > 0
          ? scores.reduce((total, score) => total + score, 0) / scores.length
          : null;

      const passedCount = results.filter((result) => result.passed).length;

      const passRate =
        results.length > 0 ? Math.round((passedCount / results.length) * 100) : null;

      return {
        id: job.id,
        title: job.title,
        company_name: job.company_name,
        is_active: job.is_active,
        created_at: job.created_at,
        link_max_uses: job.link_max_uses,
        link_use_count: job.link_use_count,
        link_expires_at: job.link_expires_at,
        candidate_count: completedAssessments.length,
        avg_score: avgScore,
        pass_rate: passRate,
      };
    });

    return { data: processedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};
