import { supabase } from "../lib/supabase";

const getResultRows = (assessments = []) =>
  assessments.flatMap((assessment) =>
    Array.isArray(assessment.results) ? assessment.results : [],
  );

const getPassedValue = (results) => {
  if (Array.isArray(results)) return results[0]?.passed;
  return results?.passed;
};

const getNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const getDashboardStats = async (uid) => {
  try {
    const [activeJobs, totalScreened, scoreRows, passRows] = await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("recruiter_id", uid)
        .eq("is_active", true),
      supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("recruiter_id", uid)
        .eq("status", "completed"),
      supabase
        .from("results")
        .select("overall_score, assessments!inner(recruiter_id)")
        .eq("assessments.recruiter_id", uid),
      supabase
        .from("results")
        .select("passed, assessments!inner(recruiter_id)")
        .eq("assessments.recruiter_id", uid),
    ]);

    const queryError = [activeJobs, totalScreened, scoreRows, passRows].find(
      (response) => response.error,
    )?.error;

    if (queryError) {
      return { data: null, error: queryError };
    }

    const scores = (scoreRows.data || [])
      .map((row) => getNumber(row.overall_score))
      .filter((score) => score !== null);
    const avgScore =
      scores.length > 0
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : null;
    const passedCount = (passRows.data || []).filter((row) => row.passed).length;
    const passRate =
      passRows.data?.length > 0 ? (passedCount / passRows.data.length) * 100 : null;

    return {
      data: {
        activeJobs: activeJobs.count || 0,
        totalScreened: totalScreened.count || 0,
        avgScore,
        passRate,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const getRecentActivity = async (uid) => {
  try {
    const { data, error: activityError } = await supabase
      .from("assessments")
      .select(
        `
          id,
          candidate_id,
          completed_at,
          candidates!inner(full_name),
          jobs!inner(id, title),
          results(passed)
        `,
      )
      .eq("recruiter_id", uid)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10);

    if (activityError) {
      return { data: null, error: activityError };
    }

    return {
      data: (data || []).map((assessment) => ({
        id: assessment.id,
        candidateId: assessment.candidate_id,
        candidateName: assessment.candidates?.full_name || "Candidate",
        jobId: assessment.jobs?.id,
        jobTitle: assessment.jobs?.title || "assessment",
        completedAt: assessment.completed_at,
        passed: getPassedValue(assessment.results),
      })),
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const getRecentJobs = async (uid) => {
  try {
    const { data, error: jobsError } = await supabase
      .from("jobs")
      .select(
        `
          id,
          title,
          company_name,
          is_active,
          created_at,
          link_max_uses,
          link_use_count,
          assessments(
            status,
            results(overall_score, passed)
          )
        `,
      )
      .eq("recruiter_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);

    if (jobsError) {
      return { data: null, error: jobsError };
    }

    return {
      data: (data || []).map((job) => {
        const completedAssessments = (job.assessments || []).filter(
          (assessment) => assessment.status === "completed",
        );
        const results = getResultRows(completedAssessments);
        const scores = results
          .map((result) => getNumber(result.overall_score))
          .filter((score) => score !== null);
        const avgScore =
          scores.length > 0
            ? scores.reduce((total, score) => total + score, 0) / scores.length
            : null;
        const passedCount = results.filter((result) => result.passed).length;
        const passRate =
          results.length > 0 ? Math.round((passedCount / results.length) * 100) : null;

        return {
          ...job,
          candidate_count: completedAssessments.length,
          avg_score: avgScore,
          pass_rate: passRate,
        };
      }),
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const getOnboardingStatus = async (uid) => {
  try {
    const onboardingResult = await supabase
      .from("profiles")
      .select("is_onboarded")
      .eq("id", uid)
      .maybeSingle();

    if (onboardingResult.data?.onboarding_complete) {
      return {
        data: {
          onboardingResult,
          profileResult: null,
          jobsResult: null,
        },
        error: null,
      };
    }

    const [profileResult, jobsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("company_name, company_website")
        .eq("id", uid)
        .maybeSingle(),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("recruiter_id", uid),
    ]);

    return {
      data: {
        onboardingResult,
        profileResult,
        jobsResult,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const markOnboardingComplete = async (uid) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { id: uid, is_onboarded: true },
        { onConflict: "id" },
      );

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
