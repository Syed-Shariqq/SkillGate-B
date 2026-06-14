import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../../../context/AuthContext";
import { supabase } from "../../../config/supabase";
import toast from "react-hot-toast";

const PlansPage = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useContext(AuthContext);

  const [openIndex, setOpenIndex] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(null);
  const [tierLoading, setTierLoading] = useState(true);

  const [currentTier, setCurrentTier] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await refreshProfile();
      if (data) setCurrentTier(data.subscription_tier);
      setTierLoading(false);
    };
    init();
  }, []);

  const tier = (
    currentTier ||
    profile?.subscription_tier ||
    "starter"
  ).toLowerCase();

  const handleUpgrade = async (priceId) => {
    setUpgradeLoading(priceId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const response = await fetch(import.meta.env.VITE_CREATE_CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          recruiterId: session.user.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Failed to create checkout session");
      }

      window.location.href = result.url;
    } catch (err) {
      console.error("Upgrade error:", err);
      toast.error(
        err.message || "An error occurred during upgrade redirection.",
      );
      setUpgradeLoading(null);
    }
  };

  const faqs = [
    {
      q: "Can I change my plan at any time?",
      a: "Yes. You can upgrade or downgrade your plan at any time from the billing portal.",
    },
    {
      q: "What happens when I reach my assessment limit?",
      a: "New candidates will not be able to start assessments until your cycle resets or you upgrade.",
    },
    {
      q: "Is there a free trial for Pro?",
      a: "We offer a 14-day free trial for Pro. No credit card required to start.",
    },
    {
      q: "How does billing work?",
      a: "Plans are billed monthly. You'll be charged on the same date each month.",
    },
    {
      q: "Can I get a refund?",
      a: "We offer a 7-day refund policy. Contact support@skillgate.app within 7 days of charge.",
    },
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (tierLoading) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-12 text-text-primary font-sans bg-primary min-h-screen">
      {/* Back link and Titles */}
      <div>
        <button
          onClick={() => navigate("/billing")}
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-smooth cursor-pointer"
        >
          ← Back to Billing
        </button>
        <h1 className="text-text-primary text-3xl font-semibold text-center mt-6">
          Choose Your Plan
        </h1>
        <p className="text-text-secondary text-sm text-center mt-1">
          Scale your hiring with AI-powered screening.
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Starter Plan */}
        <div className="bg-secondary border border-border-default rounded-xl p-6 relative flex flex-col">
          <h2 className="text-text-primary text-xl font-bold">Starter</h2>
          <div className="mt-2">
            <span className="text-text-primary text-3xl font-mono font-bold">
              $0
            </span>
            <span className="text-text-secondary text-sm"> / month</span>
          </div>
          <p className="text-text-tertiary text-sm mt-1 mb-4">
            10 assessments / month
          </p>

          <hr className="border-t border-border-default my-4" />

          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>AI question generation</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Automated scoring</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Candidate ranking</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Assessment link sharing</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-tertiary text-sm select-none opacity-50">
              <span>✗</span>
              <span>Custom branding</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-tertiary text-sm select-none opacity-50">
              <span>✗</span>
              <span>Priority support</span>
            </li>
          </ul>

          <div className="mt-auto pt-4 text-center">
            {tier === "starter" ? (
              <span className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-accent text-text-primary text-sm font-semibold select-none">
                Current Plan
              </span>
            ) : (
              <a
                href="mailto:support@skillgate.app?subject=Downgrade%20to%20Starter"
                className="inline-block text-accent hover:underline text-sm font-semibold cursor-pointer"
              >
                Contact Support to Downgrade
              </a>
            )}
          </div>
        </div>

        {/* Growth Plan */}
        <div className="bg-secondary border border-accent rounded-xl p-6 relative flex flex-col shadow-lg shadow-accent-soft/10">
          <span className="bg-accent text-text-primary rounded-full px-3 py-1 text-xs font-semibold absolute top-4 right-4">
            Most Popular
          </span>
          <h2 className="text-text-primary text-xl font-bold">Growth</h2>
          <div className="mt-2">
            <span className="text-text-primary text-3xl font-mono font-bold">
              $99
            </span>
            <span className="text-text-secondary text-sm"> / month</span>
          </div>
          <p className="text-text-tertiary text-sm mt-1 mb-4">
            100 assessments / month
          </p>

          <hr className="border-t border-border-default my-4" />

          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Everything in Starter</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Custom branding</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Priority support</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Advanced analytics</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>CSV export</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Webhook integrations</span>
            </li>
          </ul>

          <div className="mt-auto pt-4">
            {tier === "growth" ? (
              <span className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-accent text-text-primary text-sm font-semibold select-none">
                Current Plan
              </span>
            ) : tier === "scale" ? (
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-lg bg-tertiary text-text-secondary opacity-50 cursor-not-allowed text-sm font-semibold text-center"
              >
                Downgrade
              </button>
            ) : (
              <button
                onClick={() =>
                  handleUpgrade(import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID)
                }
                disabled={upgradeLoading !== null}
                className="w-full py-2.5 px-4 rounded-lg bg-accent text-text-primary hover:bg-accent-hover text-sm font-semibold transition-smooth cursor-pointer text-center flex items-center justify-center font-sans"
              >
                {upgradeLoading === import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID
                  ? "Redirecting..."
                  : "Upgrade to Growth"}
              </button>
            )}
          </div>
        </div>

        {/* Scale Plan */}
        <div className="bg-secondary border border-border-default rounded-xl p-6 relative flex flex-col">
          <h2 className="text-text-primary text-xl font-bold">Scale</h2>
          <div className="mt-2">
            <span className="text-text-primary text-3xl font-mono font-bold">
              $299
            </span>
            <span className="text-text-secondary text-sm"> / month</span>
          </div>
          <p className="text-text-tertiary text-sm mt-1 mb-4">
            500 assessments / month
          </p>

          <hr className="border-t border-border-default my-4" />

          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Everything in Growth</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Dedicated account manager</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>SSO / SAML</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>SLA guarantee</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>Custom integrations</span>
            </li>
            <li className="flex items-start gap-2.5 text-text-secondary text-sm">
              <span className="text-success font-bold">✓</span>
              <span>On-premise option</span>
            </li>
          </ul>

          <div className="mt-auto pt-4">
            {tier === "scale" ? (
              <span className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-accent text-text-primary text-sm font-semibold select-none">
                Current Plan
              </span>
            ) : (
              <button
                onClick={() =>
                  handleUpgrade(import.meta.env.VITE_STRIPE_SCALE_PRICE_ID)
                }
                disabled={upgradeLoading !== null}
                className="w-full py-2.5 px-4 rounded-lg bg-accent text-text-primary hover:bg-accent-hover text-sm font-semibold transition-smooth cursor-pointer text-center flex items-center justify-center font-sans"
              >
                {upgradeLoading === import.meta.env.VITE_STRIPE_SCALE_PRICE_ID
                  ? "Redirecting..."
                  : "Upgrade to Scale"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="pt-6">
        <h2 className="text-text-primary font-semibold text-lg mb-4">
          Full Feature Comparison
        </h2>
        <div className="overflow-x-auto border border-border-default rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-tertiary text-text-secondary text-xs uppercase font-semibold border-b border-border-default">
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3 text-center w-28">Starter</th>
                <th className="px-4 py-3 text-center w-28">Growth</th>
                <th className="px-4 py-3 text-center w-28">Scale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {[
                {
                  name: "AI Question Generation",
                  free: "✓",
                  pro: "✓",
                  ent: "✓",
                },
                { name: "Automated Scoring", free: "✓", pro: "✓", ent: "✓" },
                { name: "Candidate Ranking", free: "✓", pro: "✓", ent: "✓" },
                {
                  name: "Monthly Assessments",
                  free: "10",
                  pro: "100",
                  ent: "500",
                },
                { name: "Custom Branding", free: "—", pro: "✓", ent: "✓" },
                { name: "Advanced Analytics", free: "—", pro: "✓", ent: "✓" },
                { name: "CSV Export", free: "—", pro: "✓", ent: "✓" },
                { name: "Priority Support", free: "—", pro: "✓", ent: "✓" },
                { name: "Webhook Integrations", free: "—", pro: "✓", ent: "✓" },
                {
                  name: "Dedicated Account Manager",
                  free: "—",
                  pro: "—",
                  ent: "✓",
                },
                { name: "SSO / SAML", free: "—", pro: "—", ent: "✓" },
                { name: "SLA Guarantee", free: "—", pro: "—", ent: "✓" },
              ].map((row, idx) => (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? "bg-secondary" : "bg-primary"}`}
                >
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {row.free === "✓" ? (
                      <span className="text-success font-bold">✓</span>
                    ) : row.free === "—" ? (
                      <span className="text-text-tertiary">—</span>
                    ) : (
                      <span className="text-text-secondary font-mono">
                        {row.free}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {row.pro === "✓" ? (
                      <span className="text-success font-bold">✓</span>
                    ) : row.pro === "—" ? (
                      <span className="text-text-tertiary">—</span>
                    ) : (
                      <span className="text-text-secondary font-mono">
                        {row.pro}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {row.ent === "✓" ? (
                      <span className="text-success font-bold">✓</span>
                    ) : row.ent === "—" ? (
                      <span className="text-text-tertiary">—</span>
                    ) : (
                      <span className="text-text-secondary font-mono">
                        {row.ent}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="pt-6">
        <h2 className="text-text-primary font-semibold text-lg mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="border-b border-border-default py-4">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left text-text-primary text-sm font-medium flex justify-between items-center cursor-pointer select-none"
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-text-secondary transform transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <p className="text-text-secondary text-sm mt-2 transition-smooth">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlansPage;
