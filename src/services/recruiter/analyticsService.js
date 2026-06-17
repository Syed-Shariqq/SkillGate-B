import { supabase } from "@/lib/supabase";

// Helper functions inside the service file
const groupByDate = (assessments) => {
  const groups = {};
  assessments.forEach(a => {
    if (!a.completed_at) return;
    const date = new Date(a.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    groups[date] = (groups[date] || 0) + 1;
  });
  return Object.entries(groups).map(([date, count]) => ({ date, count }));
};

const computeMissedSkills = (assessments) => {
  const skillTotals = {};
  const skillCounts = {};
  assessments.forEach(a => {
    const scores = a.results?.[0]?.skill_scores || [];
    scores.forEach(({ skill, score }) => {
      if (!skill) return;
      skillTotals[skill] = (skillTotals[skill] || 0) + (score || 0);
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });
  return Object.entries(skillTotals)
    .map(([skill, total]) => ({
      skill,
      avgScore: Math.round(total / skillCounts[skill])
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);
};

export const getLinkOpenCount = async (uid, jobId, dateFilter) => {
  try {
    // Get job IDs for this recruiter
    let jobQuery = supabase
      .from('jobs')
      .select('id')
      .eq('recruiter_id', uid);

    if (jobId !== 'all') jobQuery = jobQuery.eq('id', jobId);

    const { data: jobs, error: jobsError } = await jobQuery;
    if (jobsError) return { data: null, error: jobsError };

    const jobIds = (jobs || []).map(j => j.id);
    if (jobIds.length === 0) return { data: 0, error: null };

    let query = supabase
      .from('link_opens')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds);

    if (dateFilter) query = query.gte('opened_at', dateFilter);

    const { count, error } = await query;
    return { data: count || 0, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAnalyticsData = async (uid, jobId, dateRange) => {
  try {
    // Step 1: Build date filter
    const now = new Date();
    const dateFilter = {
      '7d': new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      '30d': new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      '90d': new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
      'all': null
    }[dateRange];

    // Step 2: Fetch completed assessments with results
    let query = supabase
      .from('assessments')
      .select(`
        id, job_id, status, completed_at, started_at,
        jobs!inner(id, title, recruiter_id),
        results(overall_score, passed, skill_scores)
      `)
      .eq('jobs.recruiter_id', uid)
      .eq('status', 'completed');

    if (jobId !== 'all') query = query.eq('job_id', jobId);
    if (dateFilter) query = query.gte('completed_at', dateFilter);

    // Step 3: Fetch all assessments (including started, pending) for funnel
    let funnelQuery = supabase
      .from('assessments')
      .select('id, job_id, status, jobs!inner(recruiter_id)')
      .eq('jobs.recruiter_id', uid);

    if (jobId !== 'all') funnelQuery = funnelQuery.eq('job_id', jobId);
    if (dateFilter) funnelQuery = funnelQuery.gte('created_at', dateFilter);

    const [completedResult, funnelResult, openCount] = await Promise.all([
      query,
      funnelQuery,
      getLinkOpenCount(uid, jobId, dateFilter)
    ]);

    if (completedResult.error) return { data: null, error: completedResult.error };
    if (funnelResult.error) return { data: null, error: funnelResult.error };
    if (openCount.error) return { data: null, error: openCount.error };

    const completed = completedResult.data || [];
    const allAssessments = funnelResult.data || [];

    // Compute Metrics
    const totalCount = allAssessments.length;
    const completedCount = completed.length;
    const passedCount = completed.filter(a => a.results?.[0]?.passed).length;

    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

    let avgScore = null;
    if (completedCount > 0) {
      const validScores = completed
        .map(a => a.results?.[0]?.overall_score)
        .filter(score => score !== undefined && score !== null);
      if (validScores.length > 0) {
        const totalScore = validScores.reduce((sum, score) => sum + score, 0);
        avgScore = Number((totalScore / validScores.length).toFixed(1));
      }
    }

    const avgTimeTaken = null;

    const linkOpenRate = openCount.data !== null && allAssessments.length > 0
      ? Math.round((openCount.data / allAssessments.length) * 100)
      : null;

    // scoreDistribution: Bucket scores into ranges: 0-10, 11-20, ..., 91-100
    const scoreDistribution = Array.from({ length: 10 }, (_, i) => {
      const min = i * 10;
      const max = (i + 1) * 10;
      return {
        range: `${min + 1}-${max}`,
        count: completed.filter(a => {
          const score = a.results?.[0]?.overall_score ?? 0;
          return score > min && score <= max;
        }).length
      };
    });

    return {
      data: {
        completionRate,
        passRate,
        avgScore,
        avgTimeTaken,
        linkOpenRate,
        funnel: {
          opened: openCount.data ?? null,
          started: allAssessments.length,
          completed: completed.length,
          passed: completed.filter(a => a.results?.[0]?.passed).length
        },
        scoreDistribution,
        completionTrend: groupByDate(completed),
        missedSkills: computeMissedSkills(completed)
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
};

export const getJobsList = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('recruiter_id', uid)
      .order('created_at', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
