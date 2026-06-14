import React, { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "../../../context/AuthContext";
import {
  getJobSettings,
  updateJobSettings,
  resetAssessmentLink,
  deactivateJob,
  deleteJob,
} from "../../../services/jobSettingsService";

const JobSettings = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Core Data States
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Section 1: Job Info Form State
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);
  const [infoError, setInfoError] = useState(null);

  // Section 2: Skills State
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillsSuccess, setSkillsSuccess] = useState(false);
  const [skillsError, setSkillsError] = useState(null);

  // Section 3: Assessment Settings Form State
  const [minScore, setMinScore] = useState(70);
  const [timeLimit, setTimeLimit] = useState(60);
  const [expiryDate, setExpiryDate] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [allowRetakes, setAllowRetakes] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  // Section 4: Assessment Link State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingLink, setResettingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Section 5: Danger Zone State
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateForInput = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const loadSettings = async () => {
    if (!user?.id || !jobId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getJobSettings(jobId, user.id);
      if (fetchError) {
        setError("Failed to load job settings.");
      } else if (data) {
        setJob(data);
        setTitle(data.title || "");
        setCompanyName(data.company_name || "");
        setDescription(data.description || "");
        setSkills(data.skills || []);
        setMinScore(data.min_score_threshold ?? 70);
        setTimeLimit(data.time_limit_minutes ?? 60);
        setExpiryDate(formatDateForInput(data.link_expires_at));
        setMaxUses(data.link_max_uses ?? "");
        setAllowRetakes(!!data.allow_retakes);
        setShowScore(!!data.show_score_to_candidate);
      }
    } catch (err) {
      setError("Failed to load job settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [jobId, user?.id]);

  const handleSaveInfo = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id || !jobId) return;
    setSavingInfo(true);
    setInfoError(null);
    setInfoSuccess(false);

    try {
      const { error: updateError } = await updateJobSettings(jobId, user.id, {
        title: title.trim(),
        company_name: companyName.trim() || null,
        description: description.trim(),
      });

      if (updateError) {
        setInfoError("Failed to save job details.");
      } else {
        setInfoSuccess(true);
        setTimeout(() => setInfoSuccess(false), 2000);
        setJob((prev) => ({
          ...prev,
          title: title.trim(),
          company_name: companyName.trim() || null,
          description: description.trim(),
        }));
      }
    } catch (err) {
      setInfoError("An unexpected error occurred.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveSkills = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id || !jobId) return;
    setSavingSkills(true);
    setSkillsError(null);
    setSkillsSuccess(false);

    try {
      const { error: updateError } = await updateJobSettings(jobId, user.id, {
        skills,
      });

      if (updateError) {
        setSkillsError("Failed to save skills.");
      } else {
        setSkillsSuccess(true);
        setTimeout(() => setSkillsSuccess(false), 2000);
        setJob((prev) => ({ ...prev, skills }));
      }
    } catch (err) {
      setSkillsError("An unexpected error occurred.");
    } finally {
      setSavingSkills(false);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id || !jobId) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      const { error: updateError } = await updateJobSettings(jobId, user.id, {
        min_score_threshold: Number(minScore),
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
        link_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
        link_max_uses: maxUses ? Number(maxUses) : null,
        allow_retakes: allowRetakes,
        show_score_to_candidate: showScore,
      });

      if (updateError) {
        setSettingsError("Failed to save assessment settings.");
      } else {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 2000);
        setJob((prev) => ({
          ...prev,
          min_score_threshold: Number(minScore),
          time_limit_minutes: timeLimit ? Number(timeLimit) : null,
          link_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
          link_max_uses: maxUses ? Number(maxUses) : null,
          allow_retakes: allowRetakes,
          show_score_to_candidate: showScore,
        }));
      }
    } catch (err) {
      setSettingsError("An unexpected error occurred.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCopyLink = () => {
    if (!job?.assessment_link_token) return;
    const url = `https://skillgate.app/r/${job.assessment_link_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetLink = async () => {
    if (!user?.id || !jobId) return;
    setResettingLink(true);
    try {
      const { data, error: resetError } = await resetAssessmentLink(jobId, user.id);
      if (resetError) {
        // Handle inline
      } else if (data) {
        setJob((prev) => ({
          ...prev,
          assessment_link_token: data.assessment_link_token,
        }));
        setShowResetConfirm(false);
      }
    } catch (err) {
      // Handle inline
    } finally {
      setResettingLink(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user?.id || !jobId) return;
    setDeactivating(true);
    try {
      const { error: deactiveError } = await deactivateJob(jobId, user.id);
      if (!deactiveError) {
        navigate(`/jobs/${jobId}`);
      }
    } catch (err) {
      // Handle inline
    } finally {
      setDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id || !jobId || deleteInput !== job?.title) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteJob(jobId, user.id);
      if (!deleteError) {
        navigate("/jobs");
      }
    } catch (err) {
      // Handle inline
    } finally {
      setDeleting(false);
    }
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cleanSkill = skillInput.trim();
      if (!cleanSkill) return;
      if (skills.length >= 6) return;

      if (skills.some((s) => s.name.toLowerCase() === cleanSkill.toLowerCase())) {
        setSkillInput("");
        return;
      }

      setSkills([...skills, { name: cleanSkill, level: "Intermediate" }]);
      setSkillInput("");
    }
  };

  const removeSkill = (indexToRemove) => {
    setSkills(skills.filter((_, idx) => idx !== indexToRemove));
  };

  const handleLevelChange = (index, newLevel) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], level: newLevel };
    setSkills(updated);
  };

  const assessmentUrl = job ? `https://skillgate.app/r/${job.assessment_link_token}` : "";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-text-primary font-sans bg-primary min-h-screen">
      {/* Back link */}
      <div>
        <button
          onClick={() => navigate(`/jobs/${jobId}`)}
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-smooth cursor-pointer"
        >
          ← Back to Job
        </button>
        <h1 className="text-text-primary text-2xl font-semibold mt-4">Job Settings</h1>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-secondary border border-border-default rounded-xl p-5 space-y-4 animate-pulse"
            >
              <div className="h-5 bg-tertiary rounded w-1/4"></div>
              <div className="space-y-2">
                <div className="h-10 bg-tertiary rounded w-full"></div>
                <div className="h-10 bg-tertiary rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary border border-border-default rounded-xl space-y-4">
          <p className="text-error font-medium">{error}</p>
          <button
            onClick={loadSettings}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Job Info */}
          <form
            onSubmit={handleSaveInfo}
            className={`bg-secondary border border-border-default rounded-xl p-5 space-y-4 ${
              savingInfo ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <h2 className="text-text-primary text-base font-semibold">Job Info</h2>

            {/* Job Title */}
            <div className="flex flex-col">
              <label htmlFor="title" className="text-text-secondary text-sm font-medium mb-1.5">
                Job Title <span className="text-error">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <span className="text-text-tertiary text-xs text-right mt-1">
                {title.length} / 100
              </span>
            </div>

            {/* Company Name */}
            <div className="flex flex-col">
              <label htmlFor="companyName" className="text-text-secondary text-sm font-medium mb-1.5">
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Job Description */}
            <div className="flex flex-col">
              <label htmlFor="description" className="text-text-secondary text-sm font-medium mb-1.5">
                Job Description <span className="text-error">*</span>
              </label>
              <textarea
                id="description"
                required
                rows={5}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent resize-y"
              />
              <span className="text-text-tertiary text-xs text-right mt-1">
                {description.length} / 2000
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingInfo || !title.trim() || !description.trim()}
                className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingInfo ? "Saving..." : infoSuccess ? "Saved ✓" : "Save Changes"}
              </button>
              {infoError && <p className="text-error text-sm mt-2">{infoError}</p>}
            </div>
          </form>

          {/* Section 2: Skills */}
          <form
            onSubmit={handleSaveSkills}
            className={`bg-secondary border border-border-default rounded-xl p-5 space-y-4 ${
              savingSkills ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <div>
              <label htmlFor="skillInput" className="text-text-primary text-base font-semibold block">
                Required Skills
              </label>
              <span className="text-text-secondary text-xs mt-0.5 block">
                Press Enter to add. Max 6 skills.
              </span>
            </div>

            {/* Tag Pills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2.5 p-2 bg-primary/45 rounded-lg border border-border-default/60">
                {skills.map((skill, index) => (
                  <div
                    key={index}
                    className="bg-tertiary border border-border-default rounded-full px-3 py-1 text-sm flex items-center gap-2"
                  >
                    <span className="text-text-primary">{skill.name}</span>
                    <select
                      value={skill.level}
                      onChange={(e) => handleLevelChange(index, e.target.value)}
                      className="bg-transparent text-text-secondary text-xs border-none outline-none cursor-pointer"
                    >
                      <option className="bg-tertiary" value="Beginner">Beginner</option>
                      <option className="bg-tertiary" value="Intermediate">Intermediate</option>
                      <option className="bg-tertiary" value="Expert">Expert</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="text-text-tertiary hover:text-error text-base font-bold leading-none select-none transition-smooth cursor-pointer ml-0.5"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tag Input */}
            <div className="flex flex-col">
              <input
                id="skillInput"
                type="text"
                disabled={skills.length >= 6}
                placeholder={skills.length >= 6 ? "Max skills reached" : "Add a skill (e.g. React, Node.js)"}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {skills.length >= 6 && (
                <span className="text-text-tertiary text-xs mt-1.5">Max 6 skills reached</span>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSkills || skills.length === 0}
                className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSkills ? "Saving..." : skillsSuccess ? "Saved ✓" : "Save Changes"}
              </button>
              {skillsError && <p className="text-error text-sm mt-2">{skillsError}</p>}
            </div>
          </form>

          {/* Section 3: Assessment Settings */}
          <form
            onSubmit={handleSaveSettings}
            className={`bg-secondary border border-border-default rounded-xl p-5 space-y-5 ${
              savingSettings ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <h2 className="text-text-primary text-base font-semibold">Assessment Settings</h2>

            {/* Score Threshold slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="minScore" className="text-text-secondary text-sm font-medium">
                  Passing Score Threshold
                </label>
                <span className="text-accent font-mono font-semibold text-sm">
                  {minScore}%
                </span>
              </div>
              <input
                id="minScore"
                type="range"
                min={50}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer bg-primary rounded-lg appearance-none h-2"
              />
            </div>

            {/* Time Limit */}
            <div className="flex flex-col">
              <label htmlFor="timeLimit" className="text-text-secondary text-sm font-medium mb-1.5">
                Time Limit (minutes)
              </label>
              <input
                id="timeLimit"
                type="number"
                min={10}
                max={120}
                step={5}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Link Expiry */}
            <div className="flex flex-col">
              <label htmlFor="expiryDate" className="text-text-secondary text-sm font-medium mb-1.5">
                Link Expiry Date
              </label>
              <input
                id="expiryDate"
                type="date"
                min={getTodayString()}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer"
              />
            </div>

            {/* Max Uses */}
            <div className="flex flex-col">
              <label htmlFor="maxUses" className="text-text-secondary text-sm font-medium mb-1.5">
                Max Assessment Uses (optional)
              </label>
              <input
                id="maxUses"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-text-primary text-sm font-medium">Allow Retakes</span>
                  <span className="text-text-secondary text-xs">Allow candidates to retake the assessment</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowRetakes(!allowRetakes)}
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${
                    allowRetakes ? "bg-accent" : "bg-tertiary border border-border-default"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      allowRetakes ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-text-primary text-sm font-medium">Show Score to Candidate</span>
                  <span className="text-text-secondary text-xs">Show score to candidate after completion</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScore(!showScore)}
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${
                    showScore ? "bg-accent" : "bg-tertiary border border-border-default"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showScore ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSettings ? "Saving..." : settingsSuccess ? "Saved ✓" : "Save Changes"}
              </button>
              {settingsError && <p className="text-error text-sm mt-2">{settingsError}</p>}
            </div>
          </form>

          {/* Section 4: Assessment Link */}
          <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
            <h2 className="text-text-primary text-base font-semibold">Assessment Link</h2>

            <div className="space-y-4">
              <div>
                <span className="block text-text-secondary text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Current Assessment Link
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 bg-tertiary border border-border-default rounded-lg px-4 py-2.5 font-mono text-sm text-text-primary break-all select-all flex items-center">
                    {assessmentUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-secondary border border-border-default hover:bg-tertiary text-text-primary transition-smooth shrink-0 cursor-pointer"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="border-t border-border-default/50 pt-4 space-y-3">
                <button
                  onClick={() => setShowResetConfirm(!showResetConfirm)}
                  disabled={resettingLink}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-warning text-warning hover:bg-warning/10 transition-smooth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingLink ? "Resetting..." : "Reset Assessment Link"}
                </button>

                {showResetConfirm && (
                  <div className="bg-tertiary border border-border-default rounded-lg p-4 space-y-3">
                    <p className="text-sm text-text-secondary">
                      This will invalidate the current link. All existing shares will stop working.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetLink}
                        className="px-3 py-1.5 bg-warning hover:bg-warning/80 text-bg-primary text-xs font-bold rounded transition-smooth cursor-pointer"
                      >
                        Yes, Reset Link
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1.5 bg-secondary border border-border-default text-text-secondary hover:text-text-primary text-xs font-bold rounded transition-smooth cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Danger Zone */}
          <div className="bg-secondary border border-error/30 rounded-xl p-5 space-y-6">
            <h2 className="text-error font-semibold text-lg border-b border-border-default pb-3">
              Danger Zone
            </h2>

            {/* Deactivate Job */}
            {job.is_active && (
              <div className="space-y-3">
                <h3 className="text-text-primary text-sm font-semibold">Deactivate Job</h3>
                <p className="text-text-secondary text-sm">
                  Deactivate this job. The assessment link will stop accepting new candidates.
                </p>
                <button
                  onClick={() => setShowDeactivateConfirm(!showDeactivateConfirm)}
                  disabled={deactivating}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-error text-error hover:bg-error/10 transition-smooth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deactivating ? "Deactivating..." : "Deactivate Job"}
                </button>

                {showDeactivateConfirm && (
                  <div className="bg-tertiary border border-border-default rounded-lg p-4 space-y-3">
                    <p className="text-sm text-text-secondary">
                      Are you sure? This will stop accepting new candidates.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeactivate}
                        className="px-3 py-1.5 bg-error hover:bg-error/85 text-text-primary text-xs font-bold rounded transition-smooth cursor-pointer"
                      >
                        Deactivate
                      </button>
                      <button
                        onClick={() => setShowDeactivateConfirm(false)}
                        className="px-3 py-1.5 bg-secondary border border-border-default text-text-secondary hover:text-text-primary text-xs font-bold rounded transition-smooth cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delete Job */}
            <div className="space-y-3 pt-6 border-t border-border-default/50">
              <h3 className="text-text-primary text-sm font-semibold">Delete Job</h3>
              <p className="text-text-secondary text-sm">
                Permanently delete this job and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-error hover:bg-error/90 text-text-primary transition-smooth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete Job"}
              </button>

              {showDeleteConfirm && (
                <div className="bg-tertiary border border-border-default rounded-lg p-4 space-y-3">
                  <p className="text-sm text-text-secondary">
                    Type the job title to confirm deletion:
                  </p>
                  <input
                    type="text"
                    placeholder={job.title}
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    disabled={deleting}
                    className="w-full bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary/50 px-4 py-2 text-sm outline-none transition-smooth focus:border-error focus:ring-1 focus:ring-error disabled:opacity-50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleteInput !== job.title || deleting}
                      className="px-3 py-1.5 bg-error hover:bg-error/85 text-text-primary text-xs font-bold rounded transition-smooth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteInput("");
                      }}
                      className="px-3 py-1.5 bg-secondary border border-border-default text-text-secondary hover:text-text-primary text-xs font-bold rounded transition-smooth cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobSettings;
