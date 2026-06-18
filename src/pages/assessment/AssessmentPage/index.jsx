import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";

import {
  getSessionFromStorage,
  getAssessment,
  markStarted,
  restartAssessment,
} from "@/services/assessment/assessmentService";

import {
  saveResponse,
  submitAssessment,
} from "@/services/assessment/responseService";

import ProgressDots from "@/components/assessment/ProgressDots";

import AssessmentHeader from "./AssessmentHeader";
import NavigationControls from "./NavigationControls";
import QuestionContainer from "./QuestionContainer";
import ResumeOrRestartModal from "./ResumeOrRestartModal";

import toast from "react-hot-toast";

export default function AssessmentPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  // State
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(() => typeof navigator !== "undefined" && !navigator.onLine ? "offline" : null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [assessmentData, setAssessmentData] = useState(null);
  const [session, setSession] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const autosaveIntervalRef = useRef(null);
  const debounceSaveRef = useRef(null);
  const latestAnswersRef = useRef({});
  const saveVersionsRef = useRef({});
  const pendingSubmitRef = useRef(false);
  const activeSavesRef = useRef(0);
  const savedTimeoutRef = useRef(null);

  // Avoid stale closures in timers and intervals
  const currentIndexRef = useRef(0);
  const flaggedQuestionsRef = useRef(new Set());

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    flaggedQuestionsRef.current = flaggedQuestions;
  }, [flaggedQuestions]);

  // Anti-Cheat Integration
  const antiCheat = useAntiCheat({
    assessmentId: session?.assessmentId,
    enabled: Boolean(session?.assessmentId && !isLoading && !showResumeModal),
  });

  // Local Storage Save Behavior
  const saveToLocalStorage = useCallback(
    (currentAnswers, index, flags) => {
      if (!session?.assessmentId) return;

      setIsAutosaving(true);

      localStorage.setItem(
        `skillgate_answers_${session.assessmentId}`,
        JSON.stringify(currentAnswers),
      );
      localStorage.setItem(
        `skillgate_index_${session.assessmentId}`,
        String(index),
      );
      localStorage.setItem(
        `skillgate_flags_${session.assessmentId}`,
        JSON.stringify(Array.from(flags)),
      );

      setLastSavedAt(new Date());

      setTimeout(() => {
        if (mountedRef.current) {
          setIsAutosaving(false);
        }
      }, 800);
    },
    [session],
  );

  // Helper to get pending queue from localStorage
  const getPendingQueue = useCallback(() => {
    if (!session?.assessmentId) return [];
    const raw = localStorage.getItem(`skillgate_pending_saves_${session.assessmentId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // ignore safely
      }
    }
    return [];
  }, [session]);

  // Helper to save pending queue to localStorage and update state
  const savePendingQueue = useCallback((queue) => {
    if (!session?.assessmentId) return;
    localStorage.setItem(`skillgate_pending_saves_${session.assessmentId}`, JSON.stringify(queue));
    setPendingCount(queue.length);
  }, [session]);

  // Helper to enqueue a pending save
  const enqueuePendingSave = useCallback((questionId, answer) => {
    const queue = getPendingQueue();
    const newEntry = {
      questionId,
      answer,
      timeTaken: 0,
      queuedAt: new Date().toISOString()
    };
    const index = queue.findIndex(item => item.questionId === questionId);
    if (index !== -1) {
      queue[index] = newEntry;
    } else {
      queue.push(newEntry);
    }
    savePendingQueue(queue);
  }, [getPendingQueue, savePendingQueue]);

  // Helper to dequeue a pending save
  const dequeuePendingSave = useCallback((questionId) => {
    const queue = getPendingQueue();
    const filtered = queue.filter(item => item.questionId !== questionId);
    if (filtered.length !== queue.length) {
      savePendingQueue(filtered);
    }
  }, [getPendingQueue, savePendingQueue]);

  const isFlushingRef = useRef(false);

  // Sequentially attempt saving pending responses
  const flushPendingQueue = useCallback(async (activeSession) => {
    const sess = activeSession || session;
    if (!sess?.assessmentId) return;
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;

    try {
      const queue = getPendingQueue();
      let expiredDuringFlush = false;

      if (queue.length === 0) {
        isFlushingRef.current = false;
        return;
      }

      toast("Reconnected — syncing answers...");
      setSaveStatus("saving");

      for (const entry of queue) {
        if (!mountedRef.current) break;

        const { error } = await saveResponse({
          assessmentId: sess.assessmentId,
          questionId: entry.questionId,
          answer: entry.answer ?? "",
          timeTaken: entry.timeTaken ?? 0,
        });

        if (!mountedRef.current) break;

        if (error) {
          if (error.code === "ASSESSMENT_EXPIRED") {
            savePendingQueue([]);
            toast("Time's up — submitting your assessment now.", { duration: 4000 });
            expiredDuringFlush = true;
            doSubmit();
            break;
          }
        } else {
          dequeuePendingSave(entry.questionId);
        }
      }

      if (mountedRef.current && !expiredDuringFlush) {
        const finalQueue = getPendingQueue();
        if (finalQueue.length === 0) {
          toast("All synced");
          setSaveStatus("saved");
          if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
          }
          savedTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && activeSavesRef.current === 0 && getPendingQueue().length === 0) {
              setSaveStatus(prev => prev === "saved" ? null : prev);
            }
          }, 2000);
        } else {
          setSaveStatus("offline");
        }
      }
    } catch (err) {
      console.error("Error flushing pending saves:", err);
    } finally {
      isFlushingRef.current = false;
    }
  }, [session, getPendingQueue, dequeuePendingSave, savePendingQueue, doSubmit]);

  // Save Response to Backend
  const triggerSaveResponse = useCallback(
    (questionId, val) => {
      if (!session?.assessmentId) return;

      if (!saveVersionsRef.current[questionId]) {
        saveVersionsRef.current[questionId] = 0;
      }
      saveVersionsRef.current[questionId] += 1;
      const currentVersion = saveVersionsRef.current[questionId];

      const executeSave = async (isRetry = false) => {
        if (!mountedRef.current || currentVersion < saveVersionsRef.current[questionId])
          return;

        activeSavesRef.current += 1;
        setSaveStatus("saving");

        const { error } = await saveResponse({
          assessmentId: session.assessmentId,
          questionId,
          answer: val ?? "",
          timeTaken: 0,
        });

        if (!mountedRef.current) {
          activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
          return;
        }

        activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);

        if (error) {
          if (currentVersion < saveVersionsRef.current[questionId]) {
            return;
          }

          if (error.code === "ASSESSMENT_EXPIRED") {
            toast("Time's up — submitting your assessment now.", { duration: 4000 });
            doSubmit();
            return;
          }

          if (!isRetry) {
            setTimeout(() => {
              executeSave(true);
            }, 2000);
          } else {
            enqueuePendingSave(questionId, val ?? "");
            setSaveStatus("offline");
          }
        } else {
          dequeuePendingSave(questionId);

          if (currentVersion >= saveVersionsRef.current[questionId]) {
            if (activeSavesRef.current === 0) {
              setSaveStatus("saved");
              if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current);
              }
              savedTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current && activeSavesRef.current === 0 && getPendingQueue().length === 0) {
                  setSaveStatus(prev => prev === "saved" ? null : prev);
                }
              }, 2000);
            }
          }
        }
      };

      executeSave(false);
    },
    [session, enqueuePendingSave, dequeuePendingSave, getPendingQueue],
  );

  // Do Submit Action
  const doSubmit = useCallback(async () => {
    if (!session?.assessmentId) return;
    if (pendingSubmitRef.current) return;
    pendingSubmitRef.current = true;

    setIsSubmitting(true);

    const { error } = await submitAssessment({
      assessmentId: session.assessmentId,
      sessionToken: session.sessionToken,
    });

    if (!mountedRef.current) return;

    if (error) {
      toast.error(error.message || "Failed to submit assessment");
      setIsSubmitting(false);
      pendingSubmitRef.current = false;
      return;
    }

    localStorage.removeItem(`skillgate_answers_${session.assessmentId}`);
    localStorage.removeItem(`skillgate_index_${session.assessmentId}`);
    localStorage.removeItem(`skillgate_flags_${session.assessmentId}`);
    localStorage.removeItem(`skillgate_pending_saves_${session.assessmentId}`);

    navigate(`/assess/${token}/submitted`, { replace: true });
  }, [session, token, navigate]);

  // Auto Submit Callback
  const handleAutoSubmit = useCallback(async () => {
    if (pendingSubmitRef.current) return;
    pendingSubmitRef.current = true;

    toast("Time's up — submitting automatically", {
      duration: 4000,
    });

    await doSubmit();
  }, [doSubmit]);

  // Timer Initialization
  const timer = useAssessmentTimer({
    startedAt: assessmentData?.started_at || new Date().toISOString(),
    timeLimitMinutes: assessmentData?.job?.time_limit_minutes ?? 45,
    onExpire: handleAutoSubmit,
    onWarning: useCallback(() => {
      setShowWarningModal(true);
    }, []),
  });

  // Answer Change Handler
  const handleAnswer = useCallback(
    (questionId, answer) => {
      setAnswers((prev) => {
        const next = {
          ...prev,
          [questionId]: answer,
        };
        latestAnswersRef.current = next;
        return next;
      });

      // Trigger Save Response to backend
      triggerSaveResponse(questionId, answer);

      // Trigger Debounced save to Local Storage
      if (debounceSaveRef.current) {
        clearTimeout(debounceSaveRef.current);
      }

      debounceSaveRef.current = setTimeout(() => {
        saveToLocalStorage(
          latestAnswersRef.current,
          currentIndexRef.current,
          flaggedQuestionsRef.current,
        );
      }, 2000);
    },
    [triggerSaveResponse, saveToLocalStorage],
  );

  // Flag Toggle Handler
  const handleFlag = useCallback(() => {
    const currentQuestion = questions[currentIndexRef.current];
    if (!currentQuestion?.id) return;

    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  }, [questions]);

  // Unanswered Count useMemo
  const unansweredCount = useMemo(() => {
    let count = 0;
    questions.forEach((q) => {
      const value = answers[q.id];
      if (String(value ?? "").trim().length === 0) {
        count++;
      }
    });
    return count;
  }, [questions, answers]);

  // Submit Flow Handler
  const handleSubmit = useCallback(() => {
    if (pendingSubmitRef.current) return;

    if (unansweredCount > 0) {
      setShowSubmitModal(true);
    } else {
      pendingSubmitRef.current = true;
      doSubmit();
    }
  }, [unansweredCount, doSubmit]);

  const handleSubmitAnyway = useCallback(() => {
    setShowSubmitModal(false);
    if (pendingSubmitRef.current) return;
    pendingSubmitRef.current = true;
    doSubmit();
  }, [doSubmit]);

  // Resume Handler
  const handleResume = useCallback(() => {
    // NOTE: answers/currentIndex/flaggedQuestions are already rehydrated from localStorage during initializeAssessment before the modal renders; this only dismisses the modal and flushes offline saves.
    setShowResumeModal(false);
    const rawPending = localStorage.getItem(`skillgate_pending_saves_${session?.assessmentId}`);
    let pendingLength = 0;
    if (rawPending) {
      try {
        const parsed = JSON.parse(rawPending);
        if (Array.isArray(parsed)) {
          pendingLength = parsed.length;
        }
      } catch (e) {}
    }
    if (pendingLength > 0) {
      flushPendingQueue(session);
    }
  }, [session, flushPendingQueue]);

  // Restart Handler
  const handleRestart = useCallback(async () => {
    if (!session?.assessmentId) return;

    setIsRestarting(true);
    const { data, error } = await restartAssessment(session.assessmentId, session.sessionToken);

    if (error) {
      toast.error(error.message || "Failed to restart assessment");
      try {
        const res = await getAssessment({
          assessmentId: session.assessmentId,
          sessionToken: session.sessionToken,
        });
        if (res.data?.assessment) {
          setAssessmentData(res.data.assessment);
        }
      } catch (fetchErr) {
        console.error("Failed to re-fetch assessment after restart error", fetchErr);
      }
      setIsRestarting(false);
      return;
    }

    // Success flow:
    savePendingQueue([]);
    localStorage.removeItem(`skillgate_answers_${session.assessmentId}`);
    localStorage.removeItem(`skillgate_index_${session.assessmentId}`);
    localStorage.removeItem(`skillgate_flags_${session.assessmentId}`);

    setAnswers({});
    setCurrentIndex(0);
    setFlaggedQuestions(new Set());

    setIsRestarting(false);
    setShowResumeModal(false);

    navigate(`/assess/${token}`, { replace: true });
  }, [session, token, navigate, savePendingQueue]);

  // Mount Flow
  useEffect(() => {
    mountedRef.current = true;

    const initializeAssessment = async () => {
      try {
        // Read session
        const { data: sessionData } = getSessionFromStorage();
        if (!sessionData?.assessmentId || !sessionData?.sessionToken) {
          navigate(`/assess/${token}`, { replace: true });
          return;
        }

        setSession(sessionData);
        const { assessmentId, sessionToken } = sessionData;

        // Fetch assessment
        const res = await getAssessment({ assessmentId, sessionToken });
        if (!mountedRef.current) return;

        if (res.error || !res.data) {
          navigate(`/assess/${token}`, { replace: true });
          return;
        }

        const { assessment, questions: rawQuestions } = res.data;

        // Validate status and redirect if necessary
        const status = assessment?.status;
        if (
          status === "submitted" ||
          status === "completed" ||
          status === "evaluating"
        ) {
          navigate(`/assess/${token}/submitted`, { replace: true });
          return;
        }

        setAssessmentData(assessment);

        // Sort questions by order_index ascending
        const sortedQuestions = [...(rawQuestions || [])].sort((a, b) => {
          const orderA = a.order_index ?? 0;
          const orderB = b.order_index ?? 0;
          return orderA - orderB;
        });
        setQuestions(sortedQuestions);

        // Restore Local Storage persistence
        // Answers
        let restoredAnswers = {};
        const rawStoredAnswers = localStorage.getItem(
          `skillgate_answers_${assessmentId}`,
        );
        if (rawStoredAnswers) {
          try {
            const parsed = JSON.parse(rawStoredAnswers);
            if (
              parsed &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
            ) {
              const filtered = {};
              for (const [qId, val] of Object.entries(parsed)) {
                if (typeof val === "string" || val === null) {
                  filtered[qId] = val;
                }
              }
              restoredAnswers = filtered;
            }
          } catch {
            // ignore safely
          }
        }
        setAnswers(restoredAnswers);
        latestAnswersRef.current = restoredAnswers;

        // Index
        let restoredIndex = 0;
        const rawStoredIndex = localStorage.getItem(
          `skillgate_index_${assessmentId}`,
        );
        if (rawStoredIndex) {
          const parsed = Number(rawStoredIndex);
          if (Number.isFinite(parsed)) {
            const maxIdx = Math.max(0, sortedQuestions.length - 1);
            restoredIndex = Math.min(Math.max(0, parsed), maxIdx);
          }
        }
        setCurrentIndex(restoredIndex);

        // Flags
        let restoredFlags = new Set();
        const rawStoredFlags = localStorage.getItem(
          `skillgate_flags_${assessmentId}`,
        );
        if (rawStoredFlags) {
          try {
            const parsed = JSON.parse(rawStoredFlags);
            if (Array.isArray(parsed)) {
              restoredFlags = new Set(
                parsed.filter((item) => typeof item === "string"),
              );
            }
          } catch {
            // ignore safely
          }
        }
        setFlaggedQuestions(restoredFlags);

        // Mark started if status is ready
        if (status === "ready") {
          markStarted(assessmentId, sessionToken);
        }

        // Initialize pendingCount
        const rawPending = localStorage.getItem(`skillgate_pending_saves_${assessmentId}`);
        let initialPendingLength = 0;
        if (rawPending) {
          try {
            const parsed = JSON.parse(rawPending);
            if (Array.isArray(parsed)) {
              initialPendingLength = parsed.length;
            }
          } catch (e) {}
        }
        setPendingCount(initialPendingLength);

        // Check if we need to show the Resume or Restart modal
        const shouldShowResumeModal =
          assessment?.status === "in_progress" &&
          (assessment.has_responses || initialPendingLength > 0);

        if (shouldShowResumeModal) {
          setShowResumeModal(true);
          setIsLoading(false);
        } else {
          // Handle Polling if started_at is null
          if (!assessment?.started_at) {
            let elapsedPollTime = 0;
            const pollInterval = setInterval(async () => {
              elapsedPollTime += 2000;
              if (elapsedPollTime >= 10000) {
                clearInterval(pollInterval);
                if (mountedRef.current) {
                  setIsLoading(false);
                  if (initialPendingLength > 0) {
                    flushPendingQueue(sessionData);
                  }
                }
                return;
              }

              const pollRes = await getAssessment({ assessmentId, sessionToken });
              if (!mountedRef.current) {
                clearInterval(pollInterval);
                return;
              }

              if (pollRes.data?.assessment?.started_at) {
                setAssessmentData(pollRes.data.assessment);
                clearInterval(pollInterval);
                setIsLoading(false);
                if (initialPendingLength > 0) {
                  flushPendingQueue(sessionData);
                }
              }
            }, 2000);
          } else {
            setIsLoading(false);
            if (initialPendingLength > 0) {
              flushPendingQueue(sessionData);
            }
          }
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setLoadError(err?.message || "Failed to load assessment");
        setIsLoading(false);
      }
    };

    initializeAssessment();

    return () => {
      mountedRef.current = false;
    };
  }, [token, navigate]);

  // Cleanup timers, intervals, and anti-cheat beforeunload on unmount
  useEffect(() => {
    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
      if (debounceSaveRef.current) {
        clearTimeout(debounceSaveRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Handle online/offline events
  useEffect(() => {
    if (!session?.assessmentId) return;

    const handleOnline = () => {
      flushPendingQueue();
    };

    const handleOffline = () => {
      setSaveStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [session, flushPendingQueue]);

  // Periodic Save (30000ms interval)
  useEffect(() => {
    if (!session?.assessmentId) return;

    const intervalId = setInterval(() => {
      saveToLocalStorage(
        latestAnswersRef.current,
        currentIndexRef.current,
        flaggedQuestionsRef.current,
      );
    }, 30000);

    autosaveIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
    };
  }, [session, saveToLocalStorage]);

  // BeforeUnload Protection while assessment active
  useEffect(() => {
    if (isLoading || isSubmitting || !session?.assessmentId || showResumeModal) return;

    const handleBeforeUnload = (e) => {
      const msg = "Your assessment is still in progress.";
      e.returnValue = msg;
      return msg;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isLoading, isSubmitting, session, showResumeModal]);

  // Derived Collections
  const currentQuestion = useMemo(() => {
    return questions[currentIndex] ?? null;
  }, [questions, currentIndex]);

  const questionsWithFlags = useMemo(() => {
    return questions.map((q) => ({
      ...q,
      flagged: flaggedQuestions.has(q.id),
    }));
  }, [questions, flaggedQuestions]);

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex flex-col">
        {/* Sticky Header Skeleton */}
        <header className="sticky top-0 z-10 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="h-4 bg-tertiary rounded w-20"></div>
            <div className="h-4 bg-tertiary rounded w-24"></div>
          </div>
          <div className="h-6 bg-tertiary rounded w-28"></div>
        </header>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Skeleton (Desktop Only) */}
          <aside className="hidden md:flex flex-col w-44 md:w-52 shrink-0 bg-secondary border-r border-border-default h-full p-5 space-y-4 animate-pulse">
            <div className="h-5 bg-tertiary rounded w-2/3"></div>
            <div className="h-3.5 bg-tertiary rounded w-full"></div>
            <div className="grid grid-cols-4 gap-2 pt-4">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div key={idx} className="aspect-square bg-tertiary rounded"></div>
              ))}
            </div>
          </aside>

          {/* Main Question Body Skeleton */}
          <main className="flex-1 p-6 md:p-8 space-y-6 animate-pulse bg-primary overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-default pb-4">
              <div className="h-4 bg-tertiary rounded w-16"></div>
              <div className="h-4 bg-tertiary rounded w-24"></div>
            </div>
            
            {/* Question Card Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 md:p-6 space-y-4">
              <div className="h-5 bg-tertiary rounded w-full"></div>
              <div className="h-5 bg-tertiary rounded w-4/5"></div>
            </div>

            {/* Answer Area Skeleton */}
            <div className="space-y-3 pt-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="bg-secondary border border-border-default rounded-lg p-4 flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-tertiary shrink-0"></div>
                  <div className="h-4 bg-tertiary rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </main>
        </div>

        {/* Bottom Navigation controls Skeleton */}
        <footer className="bg-secondary border-t border-border-default px-6 py-4 flex items-center justify-between animate-pulse">
          <div className="h-10 bg-tertiary rounded w-24"></div>
          <div className="h-10 bg-tertiary rounded w-20"></div>
          <div className="h-10 bg-tertiary rounded w-24"></div>
        </footer>
      </div>
    );
  }

  // Resume or Restart Modal State
  if (showResumeModal) {
    return (
      <ResumeOrRestartModal
        assessment={assessmentData}
        isExpired={timer.isExpired}
        onResume={handleResume}
        onRestart={handleRestart}
        isSubmitting={isRestarting}
      />
    );
  }

  // Error State
  if (loadError) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-12 h-12 text-error mx-auto mb-4"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Error Loading Assessment
          </h2>
          <p className="text-error text-sm mb-6">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate(`/assess/${token}`, { replace: true })}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors select-none font-sans"
          >
            Return to start
          </button>
        </div>
      </div>
    );
  }

  // Empty Questions State
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-12 h-12 text-text-tertiary mx-auto mb-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 4h.01"
            />
          </svg>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            No Questions Found
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            This assessment does not contain any questions. Please contact your
            recruiter.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/assess/${token}`, { replace: true })}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors select-none font-sans"
          >
            Return to start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Sticky Header */}
      <AssessmentHeader
        isAutosaving={isAutosaving}
        saveStatus={saveStatus}
        pendingCount={pendingCount}
        formatted={timer.formatted}
        urgency={timer.urgency}
        isExpired={timer.isExpired}
        showWarningModal={showWarningModal}
        onWarningModalClose={() => setShowWarningModal(false)}
      />

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Desktop Only) */}
        <aside className="hidden md:flex flex-col w-44 md:w-52 shrink-0 bg-secondary border-r border-border-default h-full overflow-hidden">
          <ProgressDots
            title={assessmentData?.job?.title ?? "Assessment"}
            questions={questionsWithFlags}
            answers={answers}
            currentIndex={currentIndex}
            onNavigate={setCurrentIndex}
            disabled={isSubmitting}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 bg-primary">
          <QuestionContainer
            key={currentQuestion?.id}
            question={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[currentQuestion?.id] ?? null}
            onAnswer={handleAnswer}
            disablePaste={antiCheat.disablePaste}
            lastSavedAt={lastSavedAt}
            disabled={isSubmitting}
          />
        </main>
      </div>

      {/* Bottom Navigation */}
      <NavigationControls
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        isFirstQuestion={currentIndex === 0}
        isLastQuestion={currentIndex === questions.length - 1}
        isFlagged={flaggedQuestions.has(currentQuestion?.id)}
        isSubmitting={isSubmitting}
        onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() =>
          setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
        }
        onFlag={handleFlag}
        onSubmit={handleSubmit}
      />

      {/* Unanswered Submit Modal */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-secondary border border-border-default rounded-2xl p-6 md:p-8 w-full max-w-sm text-center animate-fade-in-up">
            {/* Warning Icon SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="w-9 h-9 text-warning mx-auto mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            {/* Heading */}
            <h2 className="text-text-primary text-lg font-bold mb-2">
              Unanswered Questions
            </h2>

            {/* Body */}
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              You have {unansweredCount} unanswered question(s). Are you sure
              you want to submit?
            </p>

            {/* Button Row */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-full py-2 px-4 border border-border-default bg-transparent text-text-secondary hover:bg-tertiary rounded-lg text-sm font-medium transition-colors select-none font-sans"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleSubmitAnyway}
                className="w-full py-2 px-4 bg-error hover:bg-error/80 text-white rounded-lg text-sm font-medium transition-colors select-none font-sans"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
