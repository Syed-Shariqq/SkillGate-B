import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../../../context/AuthContext";
import { getBillingInfo } from "../../../services/billingService";

const BillingPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [billingInfo, setBillingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBilling = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getBillingInfo(user.id);
      if (fetchError) {
        setError("Failed to load billing info.");
      } else {
        setBillingInfo(data);
      }
    } catch (err) {
      setError("Failed to load billing info.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [user?.id]);

  const capitalize = (str) => {
    if (!str) return "Free";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6 text-text-primary font-sans bg-primary min-h-screen">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold">Billing & Subscription</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your plan and monitor usage.</p>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-secondary border border-border-default rounded-xl p-5 space-y-4 animate-pulse"
            >
              <div className="h-5 bg-tertiary rounded w-1/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-tertiary rounded w-full"></div>
                <div className="h-4 bg-tertiary rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !billingInfo) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6 text-text-primary font-sans bg-primary min-h-screen flex flex-col items-center justify-center text-center">
        <p className="text-error font-medium">{error}</p>
        <button
          onClick={fetchBilling}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const tier = billingInfo?.subscription_tier || "free";
  const used = billingInfo?.assessments_used ?? 0;
  const limit = billingInfo?.assessments_limit ?? 50;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const barColor = percent < 60 ? "bg-accent" : percent < 80 ? "bg-warning" : "bg-error";

  const formattedDate = billingInfo?.billing_cycle_reset_at
    ? new Date(billingInfo.billing_cycle_reset_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "monthly";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 text-text-primary font-sans bg-primary min-h-screen">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your plan and monitor usage.</p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Current Plan */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary font-semibold text-base">Current Plan</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  tier === "pro"
                    ? "bg-accent-soft text-accent"
                    : tier === "enterprise"
                      ? "bg-success/15 text-success"
                      : "bg-tertiary text-text-secondary"
                }`}
              >
                {capitalize(tier)}
              </span>
            </div>
            <p className="text-text-secondary text-sm">
              {tier === "pro"
                ? "Up to 500 assessments per month"
                : tier === "enterprise"
                  ? "Unlimited assessments"
                  : "Up to 50 assessments per month"}
            </p>
          </div>
          <button
            onClick={() => navigate("/billing/plans")}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-accent text-accent hover:bg-accent-soft transition-smooth cursor-pointer text-center"
          >
            View Plans
          </button>
        </div>

        {/* Section 2: Usage */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
          <h2 className="text-text-primary font-semibold text-base">Usage This Billing Cycle</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">
                {used} of {limit} assessments used
              </span>
              <span className="text-text-secondary text-sm font-mono font-semibold">{percent}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-tertiary overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }}></div>
            </div>
          </div>
          <p className="text-text-tertiary text-xs">
            {billingInfo?.billing_cycle_reset_at ? `Resets on ${formattedDate}` : "Resets monthly"}
          </p>
        </div>

        {/* Section 3: Stripe Billing Portal */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-3">
          <h2 className="text-text-primary font-semibold text-base">Billing Portal</h2>
          <p className="text-text-secondary text-sm">
            Manage your subscription, update payment methods, and download invoices.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-text-primary opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              Open Billing Portal
            </button>
            <span className="bg-tertiary text-text-tertiary text-xs px-2.5 py-1 rounded-full font-medium select-none">
              Coming Soon
            </span>
          </div>
          <p className="text-text-tertiary text-xs">Stripe integration coming in the next release.</p>
        </div>

        {/* Section 4: Invoice History */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
          <h2 className="text-text-primary font-semibold text-base">Invoice History</h2>

          {tier === "free" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-text-tertiary text-sm">Upgrade to see invoice history</p>
              <button
                onClick={() => navigate("/billing/plans")}
                className="text-accent hover:underline text-sm font-semibold cursor-pointer"
              >
                View Plans
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-border-default rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-tertiary text-text-secondary text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default text-text-primary font-mono">
                    <tr>
                      <td className="px-4 py-3.5">—</td>
                      <td className="px-4 py-3.5">—</td>
                      <td className="px-4 py-3.5">—</td>
                      <td className="px-4 py-3.5">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-text-tertiary text-xs">
                Invoice history will appear here once Stripe is connected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
