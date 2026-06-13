import React, { useContext, useEffect, useState } from "react";
import AuthContext from "../../../context/AuthContext";
import {
  getRecruiterProfile,
  updateAccountSettings,
  updateCompanySettings,
  updateNotificationSettings,
  updatePassword,
  uploadCompanyLogo,
  deleteAccount,
} from "../../../services/recruiterSettingsService";

const RecruiterSettings = () => {
  const { user } = useContext(AuthContext);

  // Core loading/error states
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Section 1: Account settings form state
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState(null);

  // Password change state
  const [passwordState, setPasswordState] = useState({ newPassword: "", confirmPassword: "" });
  const [updatingPw, setUpdatingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState(null);

  // Section 2: Company settings form state
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySuccess, setCompanySuccess] = useState(false);
  const [companyError, setCompanyError] = useState(null);

  // Section 3: Notification settings state
  const [notifyEvery, setNotifyEvery] = useState(false);
  const [notifyPass, setNotifyPass] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(false);
  const [notificationStatusText, setNotificationStatusText] = useState("");
  const [notificationError, setNotificationError] = useState(null);

  // Section 4: Danger zone state
  const [deletionError, setDeletionError] = useState(null);

  const loadSettings = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getRecruiterProfile(user.id);
      if (fetchError) {
        setError("Failed to load settings.");
      } else if (data) {
        setProfile(data);
        setFullName(data.full_name || "");
        setWorkEmail(data.work_email || data.email || "");
        setCompanyName(data.company_name || "");
        setCompanyWebsite(data.company_website || "");
        setLogoUrl(data.company_logo_url || "");
        setNotifyEvery(!!data.notify_on_every_completion);
        setNotifyPass(!!data.notify_on_pass_only);
        setNotifyInApp(!!data.notify_inapp);
      }
    } catch (err) {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id) return;
    setSavingAccount(true);
    setAccountError(null);
    setAccountSuccess(false);

    try {
      const { error: updateError } = await updateAccountSettings(user.id, {
        full_name: fullName.trim(),
        work_email: workEmail.trim(),
      });
      if (updateError) {
        setAccountError("Failed to update account details.");
      } else {
        setAccountSuccess(true);
        setTimeout(() => setAccountSuccess(false), 2000);
      }
    } catch (err) {
      setAccountError("An unexpected error occurred.");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    if (passwordState.newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }

    setUpdatingPw(true);
    setPwError(null);
    setPwSuccess(false);

    try {
      const { error: updateError } = await updatePassword(passwordState.newPassword);
      if (updateError) {
        setPwError(updateError.message || "Failed to update password.");
      } else {
        setPwSuccess(true);
        setPasswordState({ newPassword: "", confirmPassword: "" });
        setTimeout(() => setPwSuccess(false), 2000);
      }
    } catch (err) {
      setPwError("An unexpected error occurred.");
    } finally {
      setUpdatingPw(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setLogoError(null);
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File must be under 2MB");
      return;
    }

    setLogoUploading(true);
    try {
      const { data, error: uploadError } = await uploadCompanyLogo(user.id, file);
      if (uploadError) {
        setLogoError("Failed to upload logo.");
      } else if (data?.publicUrl) {
        setLogoUrl(data.publicUrl);
      }
    } catch (err) {
      setLogoError("Failed to upload logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveCompany = async (e) => {
    if (e) e.preventDefault();
    if (!user?.id) return;
    setSavingCompany(true);
    setCompanyError(null);
    setCompanySuccess(false);

    try {
      const { error: updateError } = await updateCompanySettings(user.id, {
        company_name: companyName.trim(),
        company_website: companyWebsite.trim(),
      });
      if (updateError) {
        setCompanyError("Failed to update company details.");
      } else {
        setCompanySuccess(true);
        setTimeout(() => setCompanySuccess(false), 2000);
      }
    } catch (err) {
      setCompanyError("An unexpected error occurred.");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleToggleNotification = async (field, currentValue, setter) => {
    if (!user?.id) return;
    const nextValue = !currentValue;

    setter(nextValue);
    setNotificationStatusText("");
    setNotificationError(null);

    try {
      const { error: updateError } = await updateNotificationSettings(user.id, {
        [field]: nextValue,
      });
      if (updateError) {
        setter(currentValue);
        setNotificationError("Failed to update notification settings.");
      } else {
        setNotificationStatusText("Saved");
        setTimeout(() => setNotificationStatusText(""), 1500);
      }
    } catch (err) {
      setter(currentValue);
      setNotificationError("Failed to update notification settings.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeletionError(null);
    const { error: deleteError } = await deleteAccount(user.id);
    if (deleteError) {
      setDeletionError(deleteError.message);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-text-primary font-sans bg-primary min-h-screen">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold">Account Settings</h1>
        <p className="text-text-secondary text-sm mt-1">
          Manage your account, company, and notification preferences.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
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
          {/* Section 1: Account */}
          <form
            onSubmit={handleSaveAccount}
            className={`bg-secondary border border-border-default rounded-xl p-5 space-y-4 ${
              savingAccount ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <h2 className="text-text-primary font-semibold text-lg border-b border-border-default pb-3">
              Account
            </h2>

            {/* Full Name */}
            <div className="flex flex-col">
              <label htmlFor="fullName" className="text-text-secondary text-sm font-medium mb-1.5">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Work Email */}
            <div className="flex flex-col">
              <label htmlFor="workEmail" className="text-text-secondary text-sm font-medium mb-1.5">
                Work Email
              </label>
              <input
                id="workEmail"
                type="email"
                required
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Read-Only Auth Email */}
            <div className="flex flex-col">
              <span className="text-text-secondary text-sm font-medium mb-1.5 flex items-center gap-1.5">
                Login Email <span className="text-text-tertiary text-xs">(read-only)</span>
              </span>
              <input
                type="email"
                disabled
                value={profile?.email || ""}
                className="bg-primary border border-border-default rounded-lg text-text-tertiary px-4 py-2 text-sm outline-none opacity-60 cursor-not-allowed"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingAccount || !fullName.trim() || !workEmail.trim()}
                className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingAccount ? "Saving..." : accountSuccess ? "Saved ✓" : "Save Account"}
              </button>
              {accountError && <p className="text-error text-sm mt-2">{accountError}</p>}
            </div>

            {/* Change Password Subsection */}
            <div className="border-t border-border-default/50 pt-4 mt-4 space-y-4">
              <h3 className="text-text-primary text-sm font-semibold">Change Password</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordState.newPassword}
                  onChange={(e) =>
                    setPasswordState((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  disabled={updatingPw}
                  className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordState.confirmPassword}
                  onChange={(e) =>
                    setPasswordState((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  disabled={updatingPw}
                  className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={updatingPw || !passwordState.newPassword || !passwordState.confirmPassword}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-accent text-accent hover:bg-accent-soft transition-smooth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingPw ? "Updating..." : pwSuccess ? "Password updated ✓" : "Update Password"}
                </button>
                {pwError && <p className="text-error text-sm mt-2">{pwError}</p>}
              </div>
            </div>
          </form>

          {/* Section 2: Company */}
          <form
            onSubmit={handleSaveCompany}
            className={`bg-secondary border border-border-default rounded-xl p-5 space-y-4 ${
              savingCompany ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <h2 className="text-text-primary font-semibold text-lg border-b border-border-default pb-3">
              Company
            </h2>

            {/* Company Name */}
            <div className="flex flex-col">
              <label htmlFor="companyName" className="text-text-secondary text-sm font-medium mb-1.5">
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Company Website */}
            <div className="flex flex-col">
              <label htmlFor="companyWebsite" className="text-text-secondary text-sm font-medium mb-1.5">
                Company Website
              </label>
              <input
                id="companyWebsite"
                type="text"
                placeholder="https://yourcompany.com"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="bg-primary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary px-4 py-2 text-sm outline-none transition-smooth focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Company Logo Upload */}
            <div className="flex flex-col gap-2">
              <span className="text-text-secondary text-sm font-medium">Company Logo</span>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-border-default"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-tertiary border border-border-default flex items-center justify-center text-text-tertiary">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary border border-border-default hover:bg-tertiary text-text-primary transition-smooth cursor-pointer text-center select-none">
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={logoUploading}
                    />
                  </label>
                  <span className="text-text-tertiary text-[10px]">
                    Logo appears on candidate-facing assessment pages
                  </span>
                </div>
              </div>
              {logoError && <p className="text-error text-xs font-semibold mt-1">{logoError}</p>}
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingCompany || !companyName.trim()}
                className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCompany ? "Saving..." : companySuccess ? "Saved ✓" : "Save Company"}
              </button>
              {companyError && <p className="text-error text-sm mt-2">{companyError}</p>}
            </div>
          </form>

          {/* Section 3: Notifications */}
          <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-border-default pb-3">
              <h2 className="text-text-primary font-semibold text-lg">Notifications</h2>
              {notificationStatusText && (
                <span className="text-success text-xs font-medium">{notificationStatusText} ✓</span>
              )}
            </div>

            <div className="space-y-4 pt-2">
              {/* notify_on_every_completion */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-4">
                  <span className="text-text-primary text-sm font-medium">
                    Email me on every completion
                  </span>
                  <span className="text-text-secondary text-xs">
                    Get notified whenever a candidate completes an assessment
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleNotification(
                      "notify_on_every_completion",
                      notifyEvery,
                      setNotifyEvery
                    )
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${
                    notifyEvery ? "bg-accent" : "bg-tertiary border border-border-default"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      notifyEvery ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* notify_on_pass_only */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-4">
                  <span className="text-text-primary text-sm font-medium">
                    Email me only when candidate passes
                  </span>
                  <span className="text-text-secondary text-xs">
                    Only notify when a candidate meets the passing threshold
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleNotification("notify_on_pass_only", notifyPass, setNotifyPass)
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${
                    notifyPass ? "bg-accent" : "bg-tertiary border border-border-default"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      notifyPass ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* notify_inapp */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-4">
                  <span className="text-text-primary text-sm font-medium">In-app notifications</span>
                  <span className="text-text-secondary text-xs">
                    Show notifications in the SkillGate dashboard
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleNotification("notify_inapp", notifyInApp, setNotifyInApp)
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${
                    notifyInApp ? "bg-accent" : "bg-tertiary border border-border-default"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      notifyInApp ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {notificationError && <p className="text-error text-xs font-semibold mt-2">{notificationError}</p>}
          </div>

          {/* Section 4: Danger Zone */}
          <div className="bg-secondary border border-error/30 rounded-xl p-5 space-y-4">
            <h2 className="text-error font-semibold text-lg border-b border-border-default pb-3">
              Danger Zone
            </h2>
            <div className="space-y-3 pt-2">
              <p className="text-text-secondary text-sm">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-error hover:bg-error/90 text-text-primary transition-smooth cursor-pointer"
              >
                Delete Account
              </button>
              {deletionError && (
                <p className="text-text-secondary text-sm mt-2 font-medium">{deletionError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterSettings;
