import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "@/context/AuthContext";
import { saveJob, generateToken } from "@/services/recruiter/createJobService";

const CreateJob = () => {
  const { user, profile } = useContext(AuthContext);
  const navigate = useNavigate();

  // Form Fields State
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [expiryDate, setExpiryDate] = useState("");
  const [maxUses, setMaxUses] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill company name once profile details load
  useEffect(() => {
    if (profile?.company_name) {
      setCompanyName(profile.company_name);
    }
  }, [profile?.company_name]);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cleanSkill = skillInput.trim();
      if (!cleanSkill) return;
      if (skills.length >= 6) return;

      // Avoid duplicate skill names
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id || loading) return;

    setLoading(true);
    setError(null);

    const token = generateToken();

    const jobData = {
      title: title.trim(),
      company_name: companyName.trim() || null,
      description: description.trim(),
      skills,
      min_score_threshold: Number(minScore),
      link_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
      link_max_uses: maxUses ? Number(maxUses) : null,
      assessment_link_token: token,
    };

    const { data, error: saveError } = await saveJob(user.id, jobData);

    if (saveError) {
      setError("Failed to create job. Please try again.");
      setLoading(false);
    } else {
      navigate(`/jobs/${data.id}/success`, {
        state: {
          token,
          jobTitle: data.title,
          jobId: data.id,
        },
      });
    }
  };

  const isFormInvalid =
    !title.trim() ||
    !description.trim() ||
    skills.length === 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold font-sans">Create a New Job</h1>
        <p className="text-text-secondary text-sm mt-1 mb-6">
          Fill in the details. AI will generate a custom assessment per candidate.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`space-y-6 ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        {/* Section 1: Job Info */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
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
              placeholder="e.g. Senior React Developer"
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
              placeholder="Company name"
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
              placeholder="Describe the role and responsibilities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent resize-y"
            />
            <span className="text-text-tertiary text-xs text-right mt-1">
              {description.length} / 2000
            </span>
          </div>
        </div>

        {/* Section 2: Skills */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
          <div>
            <label htmlFor="skillInput" className="text-text-primary text-base font-semibold block">
              Required Skills
            </label>
            <span className="text-text-secondary text-xs mt-0.5 block">
              Press Enter to add. Max 6 skills.
            </span>
          </div>

          {/* Skill Tag Pills container */}
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
              <span className="text-text-tertiary text-xs mt-1.5">
                Max 6 skills reached
              </span>
            )}
          </div>
        </div>

        {/* Section 3: Assessment Settings */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-5">
          <h2 className="text-text-primary text-base font-semibold">Assessment Settings</h2>

          {/* Passing Score Slider */}
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
            <p className="text-text-tertiary text-xs">
              Candidates below this score are marked as failed
            </p>
          </div>

          {/* Expiry Date */}
          <div className="flex flex-col">
            <label htmlFor="expiryDate" className="text-text-secondary text-sm font-medium mb-1.5">
              Link Expiry Date (optional)
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
        </div>

        {/* Submit Container */}
        <div>
          <button
            type="submit"
            disabled={isFormInvalid || loading}
            className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              "Create Job"
            )}
          </button>

          {/* Error display */}
          {error && (
            <div className="text-error text-sm mt-3 flex items-center gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={handleSubmit}
                className="font-bold underline text-error hover:text-text-primary transition-smooth cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateJob;
