import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJSON } from "../_shared/ai.js";

type JsonRecord = Record<string, unknown>;

type Assessment = {
  id: string;
  job_id: string;
  status: string;
  time_limit_minutes: number | string | null;
};

type Job = {
  id: string;
  title: string;
  min_score_threshold: number | string | null;
};

type Result = {
  id: string;
  assessment_id: string;
  overall_score: number | string | null;
  confidence_score: number | string | null;
  confidence_label: string | null;
  skill_scores: unknown;
  total_points_earned: number | string | null;
  total_points_possible: number | string | null;
  time_taken_seconds: number | string | null;
  feedback_summary: string | null;
  improvement_resources: unknown;
  summary_generated: boolean;
};

type Question = {
  id: string;
  question_text: string;
  skill: string;
  order_index: number;
};

type CandidateResponse = {
  question_id: string;
  answer_given: string | null;
  score: number | string | null;
  points_earned: number | string | null;
  ai_feedback: string | null;
  missed_concepts: unknown;
  suspicious?: boolean | null;
  is_suspicious?: boolean | null;
  suspicious_flag?: boolean | null;
  keyword_stuffing?: boolean | null;
  keyword_stuffing_flag?: boolean | null;
};

type EvaluatedQuestionData = {
  skill: string;
  question: string;
  candidateAnswer: string;
  score: number;
  feedback: string;
  missedConcepts: string[];
  isSuspicious?: boolean;
  keywordStuffing?: boolean;
};

type CompressedEvaluationSignal = {
  skill: string;
  score: number;
  weak: boolean;
  summary: string;
  missedConcepts: string[];
  isSuspicious?: boolean;
  keywordStuffing?: boolean;
};

type SkillScore = {
  skill: string;
  score: number;
};

type ImprovementResourceType =
  | "article"
  | "video"
  | "practice"
  | "documentation"
  | "project";

type ImprovementResource = {
  skill: string;
  topic: string;
  type: ImprovementResourceType;
  suggestion: string;
};

type GeneratedSummary = {
  feedbackSummary: string;
  improvementResources: ImprovementResource[];
};

type HiringSignal = "Strong Yes" | "Maybe" | "No";

type ExecutiveSummary = {
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  hiringSignal: HiringSignal;
  hiringRationale: string;
};

type CandidateLevel = "Beginner" | "Intermediate" | "Advanced";

type TrainingTask = {
  title: string;
  description: string;
  duration: string;
  resource: string;
};

type TrainingPlanDay = {
  day: number;
  focus: string;
  tasks: TrainingTask[];
};

type SafeAIResult = {
  data: JsonRecord | null;
  error: unknown;
  model: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const VALID_RESOURCE_TYPES = [
  "article",
  "video",
  "practice",
  "documentation",
  "project",
];

const TRUSTED_RESOURCE_PATTERNS = [
  "MDN",
  "LeetCode",
  "roadmap.sh",
  "React Docs",
  "PostgreSQL",
  "Oracle Java",
  "Spring Docs",
  "FreeCodeCamp",
  "JavaScript.info",
  "TypeScript Docs",
];

const SUMMARY_PROMPT_VERSION = "v1";

// Validation Helpers

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readRequestBody(req: Request): Promise<JsonRecord | null> {
  try {
    const body: unknown = await req.json();
    return isRecord(body) ? body : null;
  } catch (_error) {
    return null;
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundToOne(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0);
}

function normalizeSkillScores(value: unknown): SkillScore[] {
  if (Array.isArray(value)) {
    return value
      .filter(isRecord)
      .map((item: JsonRecord): SkillScore | null => {
        const skill = typeof item.skill === "string" ? item.skill.trim() : "";
        const score = safeNumber(item.score, NaN);

        return skill && Number.isFinite(score) ? { skill, score } : null;
      })
      .filter((item): item is SkillScore => item !== null);
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .map(([skill, rawValue]: [string, unknown]): SkillScore | null => {
      if (!isRecord(rawValue)) {
        return null;
      }

      const score = safeNumber(rawValue.score, NaN);

      return Number.isFinite(score) ? { skill, score } : null;
    })
    .filter((item): item is SkillScore => item !== null);
}

function isImprovementResourceType(
  value: unknown,
): value is ImprovementResourceType {
  return (
    typeof value === "string" &&
    VALID_RESOURCE_TYPES.includes(value)
  );
}

function isValidGeneratedSummary(data: unknown): data is JsonRecord {
  return (
    isRecord(data) &&
    typeof data.feedbackSummary === "string" &&
    Array.isArray(data.improvementResources)
  );
}

function isHiringSignal(value: unknown): value is HiringSignal {
  return value === "Strong Yes" || value === "Maybe" || value === "No";
}

function isValidExecutiveSummary(data: unknown): data is JsonRecord {
  return (
    isRecord(data) &&
    typeof data.executiveSummary === "string" &&
    Array.isArray(data.strengths) &&
    Array.isArray(data.weaknesses) &&
    isHiringSignal(data.hiringSignal) &&
    typeof data.hiringRationale === "string"
  );
}

function isValidTrainingPlan(data: unknown): data is JsonRecord {
  return isRecord(data) && Array.isArray(data.plan);
}

function isMeaningfulSummary(text: unknown): text is string {
  if (typeof text !== "string") {
    return false;
  }

  const trimmed = text.trim();

  if (trimmed.length < 40) {
    return false;
  }

  const sentenceCount = trimmed
    .split(/[.!?]+/)
    .map((sentence: string) => sentence.trim())
    .filter((sentence: string) => sentence.length > 0).length;

  if (sentenceCount < 2) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const genericFillers = [
    "candidate did well",
    "needs improvement",
    "good job",
    "great candidate",
    "performed well overall",
    "has room for improvement",
    "should practice more",
    "learn fundamentals",
    "improve problem solving",
  ];

  const normalizedSummary = normalized.replace(/\s+/g, " ");

  return !genericFillers.some((filler: string) =>
    normalizedSummary === filler ||
    normalizedSummary === `${filler}.` ||
    (
      normalizedSummary.startsWith(`${filler}.`) &&
      normalizedSummary.length < 80
    )
  );
}

function isTrustedResourceSuggestion(suggestion: string): boolean {
  const normalizedSuggestion = suggestion.toLowerCase();
  const trustedResourceMatch = TRUSTED_RESOURCE_PATTERNS.some(
    (pattern: string) => normalizedSuggestion.includes(pattern.toLowerCase()),
  );

  if (!trustedResourceMatch) {
    return false;
  }

  return ![
    "my course",
    "secret course",
    "unknown bootcamp",
    "random youtube",
    "viral tutorial",
    "ultimate masterclass",
    "guaranteed job",
    "fake",
  ].some((pattern: string) => normalizedSuggestion.includes(pattern)) &&
    !/https?:\/\//i.test(suggestion);
}

function parseDurationMinutes(duration: string): number {
  const match = duration.trim().match(/^(\d+)\s*(mins?|minutes?)$/i);

  return match ? safeNumber(match[1], 0) : 0;
}

function isMeasurableTrainingTask(task: TrainingTask): boolean {
  const combined = `${task.title} ${task.description}`.toLowerCase();

  if (
    [
      "practice ",
      "learn ",
      "read about",
      "improve fundamentals",
      "understand better",
    ].some((phrase: string) => combined.includes(phrase))
  ) {
    return false;
  }

  return [
    "solve",
    "build",
    "implement",
    "create",
    "complete",
    "write",
    "add",
    "debug",
    "test",
  ].some((verb: string) => combined.includes(verb));
}

function hasFlag(
  response: CandidateResponse | undefined,
  keys: Array<keyof CandidateResponse>,
): boolean {
  return keys.some((key: keyof CandidateResponse) => response?.[key] === true);
}

// Compression Helpers

function buildEvaluatedQuestionData(
  questions: Question[],
  responses: CandidateResponse[],
): EvaluatedQuestionData[] {
  const responseMap = Object.fromEntries(
    responses.map((response: CandidateResponse) => [
      response.question_id,
      response,
    ]),
  ) as Record<string, CandidateResponse>;

  return questions.map((question: Question): EvaluatedQuestionData => {
    const response = responseMap[question.id];

    return {
      skill: question.skill,
      question: question.question_text,
      candidateAnswer: response?.answer_given?.trim() ?? "",
      score: safeNumber(response?.score),
      feedback: response?.ai_feedback?.trim() ?? "",
      missedConcepts: normalizeStringArray(response?.missed_concepts),
      isSuspicious: hasFlag(response, [
        "suspicious",
        "is_suspicious",
        "suspicious_flag",
      ]),
      keywordStuffing: hasFlag(response, [
        "keyword_stuffing",
        "keyword_stuffing_flag",
      ]),
    };
  });
}

function truncateSignalSummary(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0),
    ),
  );
}

function compressEvaluationSignals(
  evaluatedQuestionData: EvaluatedQuestionData[],
): CompressedEvaluationSignal[] {
  return evaluatedQuestionData.map(
    (item: EvaluatedQuestionData): CompressedEvaluationSignal => {
      const missedConcepts = dedupeStrings(item.missedConcepts).slice(0, 4);
      const summarySource = item.feedback || missedConcepts.join(", ") ||
        `${item.skill} response scored ${roundToOne(item.score * 100)}%`;

      return {
        skill: item.skill,
        score: roundToOne(item.score),
        weak: item.score < 0.7,
        summary: truncateSignalSummary(summarySource),
        missedConcepts,
        isSuspicious: item.isSuspicious === true,
        keywordStuffing: item.keywordStuffing === true,
      };
    },
  );
}

function limitSignalsForPrompt(
  signals: CompressedEvaluationSignal[],
  maxItems = 12,
): CompressedEvaluationSignal[] {
  return [...signals]
    .sort((
      left: CompressedEvaluationSignal,
      right: CompressedEvaluationSignal,
    ) => {
      const rightFlagged = right.isSuspicious === true ||
        right.keywordStuffing === true;
      const leftFlagged = left.isSuspicious === true ||
        left.keywordStuffing === true;
      const leftPriorityScore = left.score - (leftFlagged ? 0.25 : 0);
      const rightPriorityScore = right.score - (rightFlagged ? 0.25 : 0);

      const weakDelta = Number(right.weak) - Number(left.weak);

      if (weakDelta !== 0) {
        return weakDelta;
      }

      return leftPriorityScore - rightPriorityScore;
    })
    .slice(0, maxItems)
    .map((signal: CompressedEvaluationSignal) => ({
      ...signal,
      summary: truncateSignalSummary(signal.summary),
      missedConcepts: dedupeStrings(signal.missedConcepts).slice(0, 4),
    }));
}

function buildMissedConceptMap(
  evaluatedQuestionData: EvaluatedQuestionData[],
): Map<string, string[]> {
  const missedConceptsBySkill = new Map<string, string[]>();

  for (const item of evaluatedQuestionData) {
    const existing = missedConceptsBySkill.get(item.skill) ?? [];
    const merged = Array.from(new Set([...existing, ...item.missedConcepts]));

    if (merged.length > 0) {
      missedConceptsBySkill.set(item.skill, merged);
    }
  }

  return missedConceptsBySkill;
}

function truncateTopic(value: string): string {
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function buildResourceTopicMap(
  evaluatedQuestionData: EvaluatedQuestionData[],
): Map<string, string> {
  const topicsBySkill = new Map<string, string>();

  for (const item of evaluatedQuestionData) {
    if (topicsBySkill.has(item.skill)) {
      continue;
    }

    if (item.missedConcepts.length > 0) {
      topicsBySkill.set(item.skill, item.missedConcepts[0]);
      continue;
    }

    if (item.score < 0.7 && item.question.trim().length > 0) {
      topicsBySkill.set(
        item.skill,
        `Assessment item: ${truncateTopic(item.question.trim())}`,
      );
    }
  }

  return topicsBySkill;
}

function formatSkillScoresForPrompt(skillScores: SkillScore[]): JsonRecord[] {
  return skillScores.map((skillScore: SkillScore) => ({
    skill: skillScore.skill,
    score: roundToOne(skillScore.score),
  }));
}

function flattenMissedConceptsBySkill(
  missedConceptsBySkill: Map<string, string[]>,
): JsonRecord[] {
  return Array.from(missedConceptsBySkill.entries()).map(
    ([skill, concepts]: [string, string[]]) => ({
      skill,
      concepts: dedupeStrings(concepts).slice(0, 5),
    }),
  );
}

function determineCandidateLevel(
  percentage: number,
  confidenceScore: number,
): CandidateLevel {
  if (percentage >= 80 && confidenceScore >= 70) {
    return "Advanced";
  }

  if (percentage >= 55) {
    return "Intermediate";
  }

  return "Beginner";
}

// Fallback Helpers

function fallbackResource(skill: string, topic: string): ImprovementResource {
  const normalizedSkill = skill.toLowerCase();
  const normalizedTopic = topic || `${skill} assessment items below threshold`;

  if (normalizedSkill.includes("react")) {
    return {
      skill,
      topic: normalizedTopic,
      type: "documentation",
      suggestion:
        `Use the official React docs Learn section to review ${normalizedTopic}, then rebuild the related assessment scenario in a small component.`,
    };
  }

  if (
    normalizedSkill.includes("javascript") ||
    normalizedSkill === "js" ||
    normalizedSkill.includes("typescript")
  ) {
    return {
      skill,
      topic: normalizedTopic,
      type: "documentation",
      suggestion:
        `Use MDN JavaScript Guide pages for ${normalizedTopic}, then solve matching JavaScript exercises on FreeCodeCamp.`,
    };
  }

  if (normalizedSkill.includes("sql") || normalizedSkill.includes("postgres")) {
    return {
      skill,
      topic: normalizedTopic,
      type: "practice",
      suggestion:
        `Work through PostgreSQL documentation examples for ${normalizedTopic}, then complete related LeetCode Database problems.`,
    };
  }

  if (normalizedSkill.includes("java")) {
    return {
      skill,
      topic: normalizedTopic,
      type: "documentation",
      suggestion:
        `Use the official Java documentation and Oracle Java Tutorials to review ${normalizedTopic}, then implement a focused code example.`,
    };
  }

  if (normalizedSkill.includes("html") || normalizedSkill.includes("css")) {
    return {
      skill,
      topic: normalizedTopic,
      type: "documentation",
      suggestion:
        `Use MDN Web Docs for ${normalizedTopic}, then build a focused page section that demonstrates the concept.`,
    };
  }

  if (
    normalizedSkill.includes("algorithm") ||
    normalizedSkill.includes("data structure")
  ) {
    return {
      skill,
      topic: normalizedTopic,
      type: "practice",
      suggestion:
        `Use LeetCode topic practice for ${normalizedTopic} and write down the pattern used after each accepted solution.`,
    };
  }

  return {
    skill,
    topic: normalizedTopic,
    type: "documentation",
    suggestion:
      `Use the ${skill} roadmap on roadmap.sh to target ${normalizedTopic}, then complete one focused exercise from that section.`,
  };
}

function fallbackSummary(
  jobTitle: string,
  percentage: number,
  confidenceScore: number,
  weakSkills: string[],
  strongSkills: string[],
  resourceTopicsBySkill: Map<string, string>,
): GeneratedSummary {
  const strongSkillText = strongSkills.length > 0
    ? ` Stronger evidence appeared in ${strongSkills.slice(0, 2).join(", ")}.`
    : "";
  const weakSkillText = weakSkills.length > 0
    ? ` The clearest gaps were in ${weakSkills.slice(0, 2).join(", ")}.`
    : " The evaluation data does not show a major weak skill area.";
  const feedbackSummary =
    `For the ${jobTitle} assessment, the candidate scored ${percentage}% with a confidence score of ${confidenceScore}.` +
    strongSkillText +
    weakSkillText;

  const improvementResources = weakSkills
    .map((skill: string) => {
      const topic = resourceTopicsBySkill.get(skill) ??
        `${skill} assessment items below threshold`;

      return fallbackResource(skill, topic);
    })
    .slice(0, 4);

  return {
    feedbackSummary,
    improvementResources,
  };
}

function fallbackHiringSignal(
  percentage: number,
  weakSkills: string[],
  suspiciousCount: number,
): HiringSignal {
  if (percentage < 50 || suspiciousCount > 0) {
    return "No";
  }

  if (percentage >= 75 && weakSkills.length === 0) {
    return "Strong Yes";
  }

  return "Maybe";
}

function fallbackExecutiveSummary(
  jobTitle: string,
  percentage: number,
  passingThreshold: number,
  confidenceScore: number,
  confidenceLabel: string,
  weakSkills: string[],
  strongSkills: string[],
  suspiciousCount: number,
): ExecutiveSummary {
  const hiringSignal = fallbackHiringSignal(
    percentage,
    weakSkills,
    suspiciousCount,
  );
  const strengthText = strongSkills.length > 0
    ? `The strongest technical evidence was in ${strongSkills.slice(0, 2).join(", ")}.`
    : "The assessment did not show a clearly dominant technical strength.";
  const weaknessText = weakSkills.length > 0
    ? `The main technical gaps were in ${weakSkills.slice(0, 2).join(", ")}.`
    : "No major weak skill area was identified from the scored skill breakdown.";
  const suspiciousText = suspiciousCount > 0
    ? ` There were ${suspiciousCount} suspicious signal(s), which lowers confidence in the result.`
    : "";

  return {
    executiveSummary:
      `For the ${jobTitle} assessment, the candidate scored ${percentage}% against a ${passingThreshold}% threshold with ${confidenceScore} (${confidenceLabel}) confidence. ` +
      `${strengthText} ${weaknessText}${suspiciousText}`,
    strengths: strongSkills
      .slice(0, 3)
      .map((skill: string) => `Stronger scored performance in ${skill}`),
    weaknesses: weakSkills
      .slice(0, 3)
      .map((skill: string) => `Lower scored performance in ${skill}`),
    hiringSignal,
    hiringRationale:
      `${hiringSignal} is based on the score, weak-skill profile, confidence score, and suspicious activity count.`,
  };
}

function fallbackTrainingResource(skill: string): string {
  const normalizedSkill = skill.toLowerCase();

  if (skill === "General") {
    return "MDN JavaScript Guide: Closures";
  }

  if (normalizedSkill.includes("react")) {
    return "React Docs: State as a Snapshot";
  }

  if (
    normalizedSkill.includes("javascript") ||
    normalizedSkill.includes("typescript")
  ) {
    return normalizedSkill.includes("typescript")
      ? "TypeScript Docs: Everyday Types"
      : "MDN JavaScript Guide: Closures";
  }

  if (normalizedSkill.includes("sql") || normalizedSkill.includes("postgres")) {
    return "PostgreSQL Docs: SELECT";
  }

  if (normalizedSkill.includes("java")) {
    return "Oracle Java Tutorials: Collections";
  }

  if (
    normalizedSkill.includes("algorithm") ||
    normalizedSkill.includes("data structure")
  ) {
    return "LeetCode: Two Sum";
  }

  return `${skill} roadmap on roadmap.sh`;
}

function fallbackTrainingTask(
  skill: string,
  topic: string,
  day: number,
): TrainingTask {
  const focus = topic || `${skill} weak assessment area`;
  const resource = fallbackTrainingResource(skill);

  if (day === 7) {
    return {
      title: `Build a focused ${skill} mini-project`,
      description:
        `Create a small working example that demonstrates ${focus}; include a README with 3 decisions and one test or verification step.`,
      duration: "90 mins",
      resource,
    };
  }

  return {
    title: `Complete a ${skill} task for ${focus}`,
    description:
      `Use ${resource} to implement 3 small examples or solve 1 named exercise for ${focus}, then write 5 bullet notes on the mistakes corrected.`,
    duration: "60 mins",
    resource,
  };
}

function fallbackTrainingPlan(
  weakSkills: string[],
  missedConceptsBySkill: Map<string, string[]>,
): TrainingPlanDay[] {
  const focusSkills = weakSkills.length > 0 ? weakSkills : ["JavaScript"];

  return Array.from({ length: 7 }, (_value, index: number) => {
    const day = index + 1;
    const skill = focusSkills[Math.min(index, focusSkills.length - 1)];
    const topic = missedConceptsBySkill.get(skill)?.[0] ??
      `${skill} assessment gap`;

    return {
      day,
      focus: day === 7 ? `${skill} practical challenge` : topic,
      tasks: [fallbackTrainingTask(skill, topic, day)],
    };
  });
}

function normalizeGeneratedSummary(
  rawSummary: JsonRecord,
  fallback: GeneratedSummary,
  weakSkills: string[],
  percentage: number,
  missedConceptsBySkill: Map<string, string[]>,
): GeneratedSummary {
  const allowedSkills = new Set<string>([
    ...weakSkills,
    ...Array.from(missedConceptsBySkill.keys()),
  ]);
  const seenSkills = new Set<string>();
  const resources = Array.isArray(rawSummary.improvementResources)
    ? rawSummary.improvementResources
      .filter(isRecord)
      .map((resource: JsonRecord): ImprovementResource | null => {
        const skill = typeof resource.skill === "string"
          ? resource.skill.trim()
          : "";
        const topic = typeof resource.topic === "string"
          ? resource.topic.trim()
          : "";
        const suggestion = typeof resource.suggestion === "string"
          ? resource.suggestion.trim()
          : "";

        if (
          !skill ||
          !allowedSkills.has(skill) ||
          seenSkills.has(skill) ||
          !topic ||
          !suggestion ||
          !isImprovementResourceType(resource.type)
        ) {
          return null;
        }

        seenSkills.add(skill);

        if (!isTrustedResourceSuggestion(suggestion)) {
          return fallbackResource(skill, topic);
        }

        return {
          skill,
          topic,
          type: resource.type,
          suggestion,
        };
      })
      .filter((resource): resource is ImprovementResource => resource !== null)
      .slice(0, 4)
    : [];

  return {
    feedbackSummary:
      isMeaningfulSummary(rawSummary.feedbackSummary)
        ? rawSummary.feedbackSummary.trim()
        : fallback.feedbackSummary,
    improvementResources:
      weakSkills.length === 0 && percentage >= 80
        ? []
        : resources.length > 0
        ? resources
        : fallback.improvementResources,
  };
}

function normalizeExecutiveSummary(
  rawSummary: JsonRecord,
  fallback: ExecutiveSummary,
  percentage: number,
  weakSkills: string[],
  suspiciousCount: number,
): ExecutiveSummary {
  const expectedHiringSignal = fallbackHiringSignal(
    percentage,
    weakSkills,
    suspiciousCount,
  );
  const strengths = normalizeStringArray(rawSummary.strengths).slice(0, 3);
  const weaknesses = normalizeStringArray(rawSummary.weaknesses).slice(0, 3);
  const hiringRationale =
    typeof rawSummary.hiringRationale === "string" &&
      rawSummary.hiringRationale.trim().length >= 20
      ? rawSummary.hiringRationale.trim()
      : fallback.hiringRationale;

  return {
    executiveSummary: isMeaningfulSummary(rawSummary.executiveSummary)
      ? rawSummary.executiveSummary.trim()
      : fallback.executiveSummary,
    strengths: strengths.length > 0 ? strengths : fallback.strengths,
    weaknesses: weaknesses.length > 0 ? weaknesses : fallback.weaknesses,
    hiringSignal: expectedHiringSignal,
    hiringRationale,
  };
}

function normalizeTrainingPlan(
  rawPlan: JsonRecord,
  fallback: TrainingPlanDay[],
): TrainingPlanDay[] {
  if (!Array.isArray(rawPlan.plan)) {
    return fallback;
  }

  const normalizedDays = rawPlan.plan
    .filter(isRecord)
    .map((dayItem: JsonRecord): TrainingPlanDay | null => {
      const day = safeNumber(dayItem.day, NaN);
      const focus = typeof dayItem.focus === "string"
        ? dayItem.focus.trim()
        : "";

      if (!Number.isInteger(day) || day < 1 || day > 7 || !focus) {
        return null;
      }

      const tasks = Array.isArray(dayItem.tasks)
        ? dayItem.tasks
          .filter(isRecord)
          .map((taskItem: JsonRecord): TrainingTask | null => {
            const title = typeof taskItem.title === "string"
              ? taskItem.title.trim()
              : "";
            const description = typeof taskItem.description === "string"
              ? taskItem.description.trim()
              : "";
            const duration = typeof taskItem.duration === "string"
              ? taskItem.duration.trim()
              : "";
            const resource = typeof taskItem.resource === "string"
              ? taskItem.resource.trim()
              : "";

            if (
              !title ||
              !description ||
              !duration ||
              !resource ||
              !isTrustedResourceSuggestion(resource) ||
              !isMeasurableTrainingTask({
                title,
                description,
                duration,
                resource,
              }) ||
              parseDurationMinutes(duration) <= 0
            ) {
              return null;
            }

            return { title, description, duration, resource };
          })
          .filter((task): task is TrainingTask => task !== null)
          .slice(0, 3)
        : [];

      if (tasks.length === 0) {
        return null;
      }

      const totalMinutes = tasks.reduce(
        (sum: number, task: TrainingTask) =>
          sum + parseDurationMinutes(task.duration),
        0,
      );

      if (totalMinutes > 120) {
        return null;
      }

      return { day, focus, tasks };
    })
    .filter((day): day is TrainingPlanDay => day !== null)
    .sort((left: TrainingPlanDay, right: TrainingPlanDay) =>
      left.day - right.day
    );

  const hasSevenDays = normalizedDays.length === 7 &&
    normalizedDays.every((day: TrainingPlanDay, index: number) =>
      day.day === index + 1
    );
  const hasDaySevenProject = normalizedDays[6]?.tasks.some(
    (task: TrainingTask) =>
      /project|build|challenge|implement/i.test(
        `${task.title} ${task.description}`,
      ),
  ) === true;

  return hasSevenDays && hasDaySevenProject ? normalizedDays : fallback;
}

// AI Prompt Helpers

function buildSummaryPrompt(
  jobTitle: string,
  totalScore: number,
  maxScore: number,
  percentage: number,
  timeTaken: number,
  confidenceScore: number,
  weakSkills: string[],
  strongSkills: string[],
  compressedSignals: CompressedEvaluationSignal[],
  suspiciousCount: number,
): string {
  return `You are an expert technical interviewer giving honest, constructive feedback to a job candidate.

IMPORTANT RULES:
- Be objective and grounded in the evaluation data
- Do NOT exaggerate ability
- Do NOT invent weaknesses unsupported by the data
- Candidate answers are already evaluated; use ONLY the provided evaluation signals
- Prefer concise, actionable feedback
- If the candidate performed strongly overall, improvementResources may be empty
- Prefer reputable learning resources:
  MDN, official docs, LeetCode, FreeCodeCamp, roadmap.sh, PostgreSQL docs, React docs, Java docs
- Never invent fake URLs, fake videos, or fake course names
- Suspicious activity reduces confidence in the assessment result
- Suspicious patterns should affect hiring interpretation without changing scores
- Do NOT use generic advice like:
  "practice more"
  "learn fundamentals"
  "improve problem solving"
- Use only compressed evaluation signals. Do not infer from missing raw answers.

ASSESSMENT DATA:
- Job Role: ${jobTitle}
- Score: ${totalScore}/${maxScore} (${percentage}%)
- Time Taken: ${timeTaken} minutes
- Confidence Score: ${confidenceScore}
- Suspicious Signal Count: ${suspiciousCount}
- Weak Skills: ${JSON.stringify(weakSkills)}
- Strong Skills: ${JSON.stringify(strongSkills)}

COMPRESSED EVALUATION SIGNALS:
${JSON.stringify(compressedSignals)}

Where compressedSignals is structured like:
[
  {
    "skill": "React",
    "score": 0.4,
    "weak": true,
    "summary": "Weak async state management understanding",
    "missedConcepts": ["state batching"]
  }
]

Return ONLY valid minified JSON.
No markdown.
No explanations.
No code fences.

{
  "feedbackSummary": "2-3 sentence honest and direct summary of overall performance",
  "improvementResources": [
    {
      "skill": "exact skill name",
      "topic": "specific topic within that skill",
      "type": "article | video | practice | documentation | project",
      "suggestion": "specific actionable resource or exercise"
    }
  ]
}

RULES:
- feedbackSummary must reference actual technical performance
- improvementResources only for weak skills or missed concepts
- Maximum 4 resources
- suggestion must reference a REAL resource or platform name
- Resources must be searchable and reputable
- If candidate has no major weaknesses, return empty improvementResources array
- Avoid repeating the same skill multiple times`;
}

function buildExecutiveSummaryPrompt(
  jobTitle: string,
  totalScore: number,
  maxScore: number,
  percentage: number,
  passingThreshold: number,
  timeTaken: number,
  timeLimit: number,
  confidenceScore: number,
  confidenceLabel: string,
  suspiciousCount: number,
  skillScores: SkillScore[],
  compressedSignals: CompressedEvaluationSignal[],
): string {
  return `You are a senior technical recruiter writing an executive summary for a hiring manager.

IMPORTANT RULES:
- Be professional, concise, and evidence-based
- Do NOT exaggerate technical ability
- Do NOT infer personality traits, seniority, leadership, or communication skills unless directly evidenced
- Do NOT invent strengths unsupported by the evaluation data
- Do NOT use generic recruiter buzzwords
- Use only the provided technical signals
- Suspicious activity should reduce confidence and affect the hiring interpretation
- Do not change scores or re-evaluate answers

ASSESSMENT DATA:
- Job Role: ${jobTitle}
- Score: ${totalScore}/${maxScore} (${percentage}%)
- Passing Threshold: ${passingThreshold}%
- Time Taken: ${timeTaken} minutes
- Time Limit: ${timeLimit} minutes
- Confidence Score: ${confidenceScore} (${confidenceLabel})
- Suspicious Activity Count: ${suspiciousCount}

SKILL SCORES:
${JSON.stringify(formatSkillScoresForPrompt(skillScores))}

QUESTION EVALUATION DATA:
${JSON.stringify(compressedSignals)}

Return ONLY valid minified JSON.
No markdown.
No explanations.
No code fences.

{
  "executiveSummary": "3-4 sentence professional summary for a hiring manager",
  "strengths": [
    "specific technical strength grounded in answers"
  ],
  "weaknesses": [
    "specific technical weakness grounded in answers"
  ],
  "hiringSignal": "Strong Yes",
  "hiringRationale": "1 sentence explaining the hiring signal"
}

RULES:
- strengths and weaknesses must be grounded in actual answers or scores
- Maximum 3 strengths
- Maximum 3 weaknesses

HIRING SIGNAL RULES:

Strong Yes:
- score >= 75
- no major technical weaknesses
- no suspicious activity
- consistent technical depth

Maybe:
- mixed performance
- moderate technical gaps
- inconsistent depth
- some weak areas but recoverable

No:
- score < 50
- critical technical gaps
- suspicious behavior
- poor technical accuracy

IMPORTANT:
- hiringSignal must be EXACTLY one of:
  "Strong Yes"
  "Maybe"
  "No"

- executiveSummary must reference actual technical performance, not just the score
- Do NOT describe candidate as excellent unless clearly justified`;
}

function buildTrainingPlanPrompt(
  jobTitle: string,
  weakSkills: string[],
  missedConcepts: JsonRecord[],
  candidateLevel: CandidateLevel,
): string {
  return `You are a senior software engineer creating a focused technical improvement plan for a candidate who completed a technical assessment.

IMPORTANT RULES:
- Be practical and specific
- Avoid generic productivity advice
- Every task must produce a measurable outcome
- Prefer official documentation and reputable platforms
- Never invent fake URLs or fake resources
- Resources must be searchable and real
- Do NOT say:
  "practice more"
  "read about X"
  "improve fundamentals"

Instead provide:
- exact LeetCode problems
- exact MDN pages
- exact React docs sections
- exact PostgreSQL docs topics
- exact project tasks

ASSESSMENT DATA:
- Job Role: ${jobTitle}
- Weak Skills: ${JSON.stringify(weakSkills)}
- Missed Concepts: ${JSON.stringify(missedConcepts)}
- Candidate Level:
  ${candidateLevel}

Candidate level is determined by backend logic:
- Beginner
- Intermediate
- Advanced

Return ONLY valid minified JSON.
No markdown.
No explanations.
No code fences.

{
  "plan": [
    {
      "day": 1,
      "focus": "specific skill or concept",
      "tasks": [
        {
          "title": "task title",
          "description": "exact measurable task",
          "duration": "45 mins",
          "resource": "real searchable resource name"
        }
      ]
    }
  ]
}

RULES:
- EXACTLY 7 days
- Each day must contain 1-3 tasks
- Total daily time must NOT exceed 2 hours
- Days 1-3 must prioritize weakest skills
- Day 7 must contain a mini-project or practical challenge
- Every task must produce a measurable outcome
- Resource names must be real and searchable
- Prefer:
  MDN
  React Docs
  Java Docs
  PostgreSQL Docs
  roadmap.sh
  LeetCode
  FreeCodeCamp
  official documentation

GOOD TASK EXAMPLES:
- Solve LeetCode "Two Sum" using hash maps
- Read MDN Closures Guide and implement 3 closure examples
- Build pagination API using Spring Boot and PostgreSQL
- Complete React Docs section: State as a Snapshot

BAD TASK EXAMPLES:
- Practice React
- Learn JavaScript better
- Improve SQL understanding`;
}

function getAIModelName(aiResult: unknown): string {
  if (!isRecord(aiResult)) {
    return "unknown";
  }

  const model = aiResult.model ?? aiResult.provider ?? aiResult.summary_model;

  return typeof model === "string" && model.trim().length > 0
    ? model.trim()
    : "unknown";
}

function shouldRetryAIResult(aiResult: unknown, parsedError: unknown): boolean {
  if (parsedError) {
    return true;
  }

  if (!isRecord(aiResult)) {
    return true;
  }

  const data = aiResult.data;

  if (typeof data !== "string" || data.trim().length === 0) {
    return true;
  }

  return Boolean(aiResult.error);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAISafely(
  prompt: string,
  tokens: number,
): Promise<SafeAIResult> {
  const maxAttempts = 3;
  let lastError: unknown = null;
  let lastModel = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const aiResult = await callAI(prompt, tokens);
      lastModel = getAIModelName(aiResult);

      if (aiResult.error || !aiResult.data) {
        lastError = aiResult.error ?? "AI returned empty response";

        if (attempt < maxAttempts && shouldRetryAIResult(aiResult, null)) {
          console.error("[generate-summary][retry]", {
            attempt,
            reason: lastError,
          });
          await sleep(2 ** (attempt - 1) * 500);
          continue;
        }

        return { data: null, error: lastError, model: lastModel };
      }

      const parsed = parseJSON(aiResult.data);

      if (parsed.error || !parsed.data) {
        lastError = parsed.error ?? "AI response could not be parsed";

        if (attempt < maxAttempts && shouldRetryAIResult(aiResult, lastError)) {
          console.error("[generate-summary][retry]", {
            attempt,
            reason: lastError,
          });
          await sleep(2 ** (attempt - 1) * 500);
          continue;
        }

        return { data: null, error: lastError, model: lastModel };
      }

      return {
        data: isRecord(parsed.data) ? parsed.data : null,
        error: isRecord(parsed.data) ? null : "Parsed AI response is not JSON object",
        model: lastModel,
      };
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        console.error("[generate-summary][retry]", {
          attempt,
          reason: error instanceof Error ? error.message : String(error),
        });
        await sleep(2 ** (attempt - 1) * 500);
        continue;
      }
    }
  }

  return { data: null, error: lastError, model: lastModel };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await readRequestBody(req);
    const assessmentId = typeof body?.assessmentId === "string"
      ? body.assessmentId.trim()
      : "";
    const resultId = typeof body?.resultId === "string"
      ? body.resultId.trim()
      : "";

    if (!assessmentId && !resultId) {
      return jsonResponse(
        { error: "assessmentId or resultId is required" },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const resultQuery = supabase
      .from("results")
      .select(
        "id, assessment_id, overall_score, confidence_score, confidence_label, skill_scores, total_points_earned, total_points_possible, time_taken_seconds, feedback_summary, improvement_resources, summary_generated",
      );
    const { data: result, error: resultError } = resultId
      ? await resultQuery.eq("id", resultId).maybeSingle<Result>()
      : await resultQuery.eq("assessment_id", assessmentId).maybeSingle<Result>();

    if (resultError) {
      console.error("[generate-summary][db]", "result fetch failed", resultError);
      return jsonResponse({ error: resultError.message }, 500);
    }

    if (!result) {
      return jsonResponse({ error: "Result not found" }, 404);
    }

    console.log("[generate-summary] started", result.id);

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, job_id, status, time_limit_minutes")
      .eq("id", result.assessment_id)
      .maybeSingle<Assessment>();

    if (assessmentError) {
      console.error(
        "[generate-summary][db]",
        "assessment fetch failed",
        assessmentError,
      );
      return jsonResponse({ error: assessmentError.message }, 500);
    }

    if (!assessment) {
      return jsonResponse({ error: "Assessment not found" }, 404);
    }

    if (assessment.status !== "completed") {
      return jsonResponse(
        {
          error: "Assessment result is not completed",
          currentStatus: assessment.status,
        },
        400,
      );
    }

    if (result.summary_generated) {
      return jsonResponse({
        status: "already_generated",
        resultId: result.id,
        feedbackSummary: result.feedback_summary,
        improvementResources: result.improvement_resources ?? [],
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, min_score_threshold")
      .eq("id", assessment.job_id)
      .single<Job>();

    if (jobError) {
      console.error("[generate-summary][db]", "job fetch failed", jobError);
      return jsonResponse({ error: jobError.message }, 500);
    }

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, question_text, skill, order_index")
      .eq("assessment_id", result.assessment_id)
      .order("order_index", { ascending: true })
      .returns<Question[]>();

    if (questionsError) {
      console.error(
        "[generate-summary][db]",
        "questions fetch failed",
        questionsError,
      );
      return jsonResponse({ error: questionsError.message }, 500);
    }

    const { data: responses, error: responsesError } = await supabase
      .from("responses")
      .select("*")
      .eq("assessment_id", result.assessment_id)
      .returns<CandidateResponse[]>();

    if (responsesError) {
      console.error(
        "[generate-summary][db]",
        "responses fetch failed",
        responsesError,
      );
      return jsonResponse({ error: responsesError.message }, 500);
    }

    const evaluatedQuestionData = buildEvaluatedQuestionData(
      questions ?? [],
      responses ?? [],
    );
    const compressedSignals = limitSignalsForPrompt(
      compressEvaluationSignals(evaluatedQuestionData),
    );
    const suspiciousCount = compressedSignals.filter(
      (signal: CompressedEvaluationSignal) => signal.isSuspicious,
    ).length;

    console.log(
      "[generate-summary] compressed-signals",
      compressedSignals.length,
    );

    const skillScores = normalizeSkillScores(result.skill_scores);
    const weakSkills = skillScores
      .filter((skillScore: SkillScore) => skillScore.score < 70)
      .map((skillScore: SkillScore) => skillScore.skill);
    const strongSkills = skillScores
      .filter((skillScore: SkillScore) => skillScore.score >= 80)
      .map((skillScore: SkillScore) => skillScore.skill);
    const missedConceptsBySkill = buildMissedConceptMap(evaluatedQuestionData);
    const resourceTopicsBySkill = buildResourceTopicMap(evaluatedQuestionData);
    const percentage = roundToOne(safeNumber(result.overall_score));
    const totalScore = roundToOne(safeNumber(result.total_points_earned));
    const maxScore = roundToOne(safeNumber(result.total_points_possible));
    const timeTaken = roundToOne(safeNumber(result.time_taken_seconds) / 60);
    const confidenceScore = roundToOne(safeNumber(result.confidence_score));
    const confidenceLabel =
      typeof result.confidence_label === "string" &&
        result.confidence_label.trim().length > 0
        ? result.confidence_label.trim()
        : "Low";
    const passingThreshold = roundToOne(
      safeNumber(job.min_score_threshold, 70),
    );
    const timeLimit = roundToOne(
      safeNumber(assessment.time_limit_minutes, 0),
    );
    const candidateLevel = determineCandidateLevel(
      percentage,
      confidenceScore,
    );
    const missedConcepts = flattenMissedConceptsBySkill(
      missedConceptsBySkill,
    );
    const fallback = fallbackSummary(
      job.title,
      percentage,
      confidenceScore,
      weakSkills,
      strongSkills,
      resourceTopicsBySkill,
    );
    let generatedSummary = fallback;
    const fallbackExecutive = fallbackExecutiveSummary(
      job.title,
      percentage,
      passingThreshold,
      confidenceScore,
      confidenceLabel,
      weakSkills,
      strongSkills,
      suspiciousCount,
    );
    let executiveSummary = fallbackExecutive;
    let trainingPlan = fallbackTrainingPlan(
      weakSkills,
      missedConceptsBySkill,
    );
    let summaryModel = "unknown";

    const prompt = buildSummaryPrompt(
      job.title,
      totalScore,
      maxScore,
      percentage,
      timeTaken,
      confidenceScore,
      weakSkills,
      strongSkills,
      compressedSignals,
      suspiciousCount,
    );
    const estimatedTokenBudget = Math.min(
      2400,
      Math.max(
        1200,
        compressedSignals.length * 120,
      ),
    );
    const aiResult = await callAISafely(prompt, estimatedTokenBudget);
    summaryModel = aiResult.model;

    if (aiResult.error || !aiResult.data) {
      console.error(
        "[generate-summary][ai]",
        aiResult.error ?? "AI summary generation failed",
      );
      console.log("[generate-summary] fallback-used");
    } else {
      if (!isValidGeneratedSummary(aiResult.data)) {
        console.error(
          "[generate-summary][validation]",
          "Invalid generated summary structure",
        );
        console.log("[generate-summary] fallback-used");
      } else {
        generatedSummary = normalizeGeneratedSummary(
          aiResult.data,
          fallback,
          weakSkills,
          percentage,
          missedConceptsBySkill,
        );

        if (generatedSummary.feedbackSummary === fallback.feedbackSummary) {
          console.error(
            "[generate-summary][validation]",
            "AI feedbackSummary failed meaningfulness validation",
          );
          console.log("[generate-summary] fallback-used");
        }
      }
    }

    const executivePrompt = buildExecutiveSummaryPrompt(
      job.title,
      totalScore,
      maxScore,
      percentage,
      passingThreshold,
      timeTaken,
      timeLimit,
      confidenceScore,
      confidenceLabel,
      suspiciousCount,
      skillScores,
      compressedSignals,
    );
    const executiveTokenBudget = Math.min(
      2400,
      Math.max(
        1200,
        compressedSignals.length * 140,
      ),
    );
    const executiveResult = await callAISafely(
      executivePrompt,
      executiveTokenBudget,
    );

    if (summaryModel === "unknown") {
      summaryModel = executiveResult.model;
    }

    if (executiveResult.error || !executiveResult.data) {
      console.error(
        "[generate-summary][ai]",
        executiveResult.error ?? "AI executive summary generation failed",
      );
      console.log("[generate-summary] fallback-used");
    } else if (!isValidExecutiveSummary(executiveResult.data)) {
      console.error(
        "[generate-summary][validation]",
        "Invalid executive summary structure",
      );
      console.log("[generate-summary] fallback-used");
    } else {
      executiveSummary = normalizeExecutiveSummary(
        executiveResult.data,
        executiveSummary,
        percentage,
        weakSkills,
        suspiciousCount,
      );

      if (
        executiveSummary.executiveSummary === fallbackExecutive.executiveSummary
      ) {
        console.error(
          "[generate-summary][validation]",
          "AI executiveSummary failed meaningfulness validation",
        );
        console.log("[generate-summary] fallback-used");
      }
    }

    const trainingPrompt = buildTrainingPlanPrompt(
      job.title,
      weakSkills,
      missedConcepts,
      candidateLevel,
    );
    const trainingTokenBudget = Math.min(
      2400,
      Math.max(
        1200,
        Math.max(weakSkills.length, 1) * 220,
      ),
    );
    const trainingResult = await callAISafely(
      trainingPrompt,
      trainingTokenBudget,
    );

    if (summaryModel === "unknown") {
      summaryModel = trainingResult.model;
    }

    if (trainingResult.error || !trainingResult.data) {
      console.error(
        "[generate-summary][ai]",
        trainingResult.error ?? "AI training plan generation failed",
      );
      console.log("[generate-summary] fallback-used");
    } else if (!isValidTrainingPlan(trainingResult.data)) {
      console.error(
        "[generate-summary][validation]",
        "Invalid training plan structure",
      );
      console.log("[generate-summary] fallback-used");
    } else {
      const normalizedTrainingPlan = normalizeTrainingPlan(
        trainingResult.data,
        trainingPlan,
      );

      if (normalizedTrainingPlan === trainingPlan) {
        console.error(
          "[generate-summary][validation]",
          "AI training plan failed validation",
        );
        console.log("[generate-summary] fallback-used");
      }

      trainingPlan = normalizedTrainingPlan;
    }

    const { data: updatedResult, error: updateError } = await supabase
      .from("results")
      .update({
        feedback_summary: generatedSummary.feedbackSummary,
        improvement_resources: generatedSummary.improvementResources,
        executive_summary: executiveSummary.executiveSummary,
        strengths: executiveSummary.strengths,
        weaknesses: executiveSummary.weaknesses,
        hiring_signal: executiveSummary.hiringSignal,
        training_plan: trainingPlan,
        summary_generated: true,
        summary_model: summaryModel,
        summary_prompt_version: SUMMARY_PROMPT_VERSION,
        summary_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", result.id)
      .eq("summary_generated", false)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateError) {
      console.error("[generate-summary][db]", "result update failed", updateError);
      return jsonResponse({ error: updateError.message }, 500);
    }

    if (!updatedResult) {
      return jsonResponse({
        status: "already_generated",
        resultId: result.id,
      });
    }

    return jsonResponse({
      status: "summary_generated",
      resultId: result.id,
      feedbackSummary: generatedSummary.feedbackSummary,
      improvementResources: generatedSummary.improvementResources,
      executiveSummary: executiveSummary.executiveSummary,
      strengths: executiveSummary.strengths,
      weaknesses: executiveSummary.weaknesses,
      hiringSignal: executiveSummary.hiringSignal,
      hiringRationale: executiveSummary.hiringRationale,
      trainingPlan,
    });
  } catch (error) {
    console.error("[generate-summary]", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return jsonResponse({ error: message }, 500);
  }
});
