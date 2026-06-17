import { supabase } from "@/lib/supabase";

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

export const getJobById = async (jobId, uid) => {
  try {
    const [jobResult, openCountResult] = await Promise.all([
      supabase
        .from('jobs')
        .select(`
          id, title, company_name, is_active, assessment_link_token,
          link_expires_at, link_max_uses, link_use_count,
          min_score_threshold, created_at
        `)
        .eq('id', jobId)
        .eq('recruiter_id', uid)
        .maybeSingle(),
      supabase
        .from('link_opens')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
    ]);

    if (jobResult.error) return { data: null, error: jobResult.error };

    return {
      data: {
        ...jobResult.data,
        open_count: openCountResult.count || 0
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const getJobCandidates = async (jobId, uid) => {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select(`
        id, full_name, email, status, created_at,
        assessments!inner(
          id, status, tab_switches, paste_attempts, is_flagged, completed_at,
          results(overall_score, passed, confidence_label, time_taken_seconds)
        )
      `)
      .eq("job_id", jobId)
      .eq("recruiter_id", uid)
      .eq("assessments.status", "completed");

    if (error) {
      return { data: null, error };
    }

    const sortedData = (data || []).sort((a, b) => {
      const scoreA = a.assessments?.[0]?.results?.[0]?.overall_score ?? 0;
      const scoreB = b.assessments?.[0]?.results?.[0]?.overall_score ?? 0;
      return scoreB - scoreA;
    });

    const mapped = sortedData.map((candidate, index) => {
      const assessment = candidate.assessments?.[0] || {};
      const result = assessment.results?.[0] || {};
      return {
        id: candidate.id,
        rank: index + 1,
        name: candidate.full_name,
        email: candidate.email,
        status: candidate.status,
        score: result.overall_score ?? 0,
        passed: result.passed ?? false,
        confidence: result.confidence_label ?? "Low",
        tabSwitches: assessment.tab_switches ?? 0,
        pasteAttempts: assessment.paste_attempts ?? 0,
        timeTaken: result.time_taken_seconds ?? 0,
        shortlisted: candidate.status === "shortlisted",
        rejected: candidate.status === "rejected",
        completedAt: assessment.completed_at,
      };
    });

    return { data: mapped, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const toggleJobActive = async (jobId, uid, isActive) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .update({ is_active: isActive })
      .eq("id", jobId)
      .eq("recruiter_id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateCandidateStatus = async (candidateId, uid, status) => {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .update({ status })
      .eq("id", candidateId)
      .eq("recruiter_id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const bulkUpdateCandidateStatus = async (candidateIds, uid, status) => {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .update({ status })
      .in("id", candidateIds)
      .eq("recruiter_id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const exportCandidatesCSV = (candidates, jobTitle) => {
  const headers = ['Rank','Name','Email','Score','Passed','Confidence','Tab Switches','Paste Attempts','Time (s)','Status'];
  const rows = candidates.map(c => [
    c.rank, c.name, c.email, c.score,
    c.passed ? 'Yes' : 'No',
    c.confidence, c.tabSwitches, c.pasteAttempts,
    c.timeTaken, c.status
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${jobTitle}-candidates.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
