import { supabase } from "../lib/supabase";

export const getCandidateProfile = async (candidateId, uid) => {
  try {
    const [candRes, respRes, jobsRes] = await Promise.all([
      supabase
        .from("candidates")
        .select(`
          id, full_name, email, status, job_id, created_at,
          assessments!inner(
            id, status, tab_switches, paste_attempts,
            is_flagged, completed_at, time_limit_minutes,
            results(
              overall_score, passed, confidence_score, confidence_label,
              skill_scores, total_points_earned, total_points_possible,
              time_taken_seconds, feedback_summary, executive_summary,
              hiring_signal, hiring_rationale, strengths, weaknesses
            )
          )
        `)
        .eq("id", candidateId)
        .eq("recruiter_id", uid)
        .eq("assessments.status", "completed")
        .maybeSingle(),
      supabase
        .from("responses")
        .select(`
          id, answer_given, is_correct, score, points_earned,
          ai_feedback, missed_concepts, time_taken_seconds,
          questions(
            id, question_text, question_type, skill,
            difficulty, options, correct_answer, ideal_answer, points, order_index
          )
        `)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, title, min_score_threshold")
        .eq("recruiter_id", uid)
    ]);

    if (candRes.error) {
      return { data: null, error: candRes.error };
    }
    if (respRes.error) {
      return { data: null, error: respRes.error };
    }
    if (jobsRes.error) {
      return { data: null, error: jobsRes.error };
    }

    const candidateData = candRes.data;
    if (!candidateData) {
      return { data: null, error: new Error("Candidate not found") };
    }

    const assessment = candidateData.assessments?.[0] || {};
    const result = assessment.results?.[0] || {};
    const job = (jobsRes.data || []).find((j) => j.id === candidateData.job_id) || null;

    const mappedResponses = (respRes.data || []).map((resp) => {
      const q = resp.questions || {};
      return {
        id: resp.id,
        answer_given: resp.answer_given,
        is_correct: resp.is_correct,
        score: resp.score,
        points_earned: resp.points_earned,
        ai_feedback: resp.ai_feedback,
        missed_concepts: resp.missed_concepts,
        time_taken_seconds: resp.time_taken_seconds,
        question: {
          question_text: q.question_text,
          question_type: q.question_type,
          skill: q.skill,
          difficulty: q.difficulty,
          options: q.options,
          correct_answer: q.correct_answer,
          ideal_answer: q.ideal_answer,
          points: q.points,
          order_index: q.order_index,
        },
      };
    });

    const mappedData = {
      candidate: {
        id: candidateData.id,
        full_name: candidateData.full_name,
        email: candidateData.email,
        status: candidateData.status,
        job_id: candidateData.job_id,
        created_at: candidateData.created_at,
      },
      assessment: {
        id: assessment.id,
        tab_switches: assessment.tab_switches,
        paste_attempts: assessment.paste_attempts,
        is_flagged: assessment.is_flagged,
        completed_at: assessment.completed_at,
      },
      result: {
        overall_score: result.overall_score,
        passed: result.passed,
        confidence_score: result.confidence_score,
        confidence_label: result.confidence_label,
        skill_scores: result.skill_scores,
        total_points_earned: result.total_points_earned,
        total_points_possible: result.total_points_possible,
        time_taken_seconds: result.time_taken_seconds,
        feedback_summary: result.feedback_summary,
        executive_summary: result.executive_summary,
        hiring_signal: result.hiring_signal,
        hiring_rationale: result.hiring_rationale,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
      },
      responses: mappedResponses,
      job: job
        ? {
            id: job.id,
            title: job.title,
            min_score_threshold: job.min_score_threshold,
          }
        : null,
    };

    return { data: mappedData, error: null };
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

export const saveInternalNote = async (candidateId, uid, note) => {
  return { data: null, error: null };
};
