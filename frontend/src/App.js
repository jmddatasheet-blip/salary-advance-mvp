import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ---------------------
// API helpers
// ---------------------
const api = axios.create({
  baseURL: API,
});

async function createApplication(applicantName) {
  const res = await api.post("/salary-advance/applications", {
    applicant_name: applicantName || "Demo User",
  });
  return res.data;
}

async function getCurrentApplication() {
  const res = await api.get("/salary-advance/applications/current");
  return res.data;
}

async function submitKyc(payload) {
  const res = await api.post("/salary-advance/kyc/submit", payload);
  return res.data;
}

async function submitIncome(payload) {
  const res = await api.post("/salary-advance/income/submit", payload);
  return res.data;
}

async function scoreRisk(payload) {
  const res = await api.post("/salary-advance/risk/score", payload);
  return res.data;
}

async function generateOffer(payload) {
  const res = await api.post("/salary-advance/offer/generate", payload);
  return res.data;
}

async function acceptOffer(payload) {
  const res = await api.post("/salary-advance/offer/accept", payload);
  return res.data;
}

async function completeVideoKyc(payload) {
  const res = await api.post("/salary-advance/video-kyc/complete", payload);
  return res.data;
}

async function disburse(payload) {
  const res = await api.post("/salary-advance/disbursement", payload);
  return res.data;
}

async function recordRepayment(payload) {
  const res = await api.post("/salary-advance/repayment/record", payload);
  return res.data;
}

// ---------------------
// UI components
// ---------------------

function Landing() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleApply = async () => {
    try {
      setLoading(true);
      setError("");
      const app = await createApplication(name.trim() || "Demo User");
      if (app?.id) {
        navigate("/journey");
      }
    } catch (e) {
      console.error(e);
      setError("Could not start application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-3xl w-full space-y-10">
        <header className="space-y-4 text-center">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
            data-testid="hero-title"
          >
            Get your salary advance in minutes
          </h1>
          <p
            className="text-slate-300 max-w-xl mx-auto"
            data-testid="hero-subtitle"
          >
            Apply → KYC → Income Check → Risk Scoring → Offer → Consent → Video
            KYC → Disbursement → Repayment → Closure. Start your journey now.
          </p>
        </header>

        <main className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-200"
            >
              Your full name
            </label>
            <input
              id="name"
              data-testid="applicant-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your name to begin"
            />
          </div>

          {error && (
            <div
              className="text-sm text-red-400"
              data-testid="apply-error-message"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            data-testid="apply-salary-advance-button"
            onClick={handleApply}
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors"
          >
            {loading ? "Starting your application..." : "Apply for Salary Advance"}
          </button>

          <p
            className="text-xs text-slate-400 text-center"
            data-testid="hero-disclaimer"
          >
            This is a demo flow. All verifications, risk checks and disbursement
            are simulated for product design purposes.
          </p>
        </main>
      </div>
    </div>
  );
}

function Journey() {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kyc, setKyc] = useState({ pan: "", aadhaar: "", selfieUrl: "" });
  const [income, setIncome] = useState({
    employer_name: "",
    avg_net_salary: "",
    salary_credit_dates: "",
  });
  const [repaymentLateFee, setRepaymentLateFee] = useState("");

  const refreshApp = async () => {
    try {
      setError("");
      const current = await getCurrentApplication();
      setApp(current);
    } catch (e) {
      console.error(e);
      setError("Could not load application.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshApp();
  }, []);

  const handleSubmitKyc = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await submitKyc({
        app_id: app.id,
        pan: kyc.pan,
        aadhaar: kyc.aadhaar,
        selfie_url: kyc.selfieUrl || undefined,
      });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.detail || "KYC submission failed. Please check details.",
      );
      setLoading(false);
    }
  };

  const handleSubmitIncome = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await submitIncome({
        app_id: app.id,
        employer_name: income.employer_name,
        avg_net_salary: Number(income.avg_net_salary),
        salary_credit_dates: income.salary_credit_dates
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.detail ||
          "Income submission failed. Please check details.",
      );
      setLoading(false);
    }
  };

  const handleRiskAndOffer = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await scoreRisk({ app_id: app.id });
      await generateOffer({ app_id: app.id });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError("Risk scoring or offer generation failed.");
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await acceptOffer({ app_id: app.id, language: "en+hi" });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError("Could not accept offer.");
      setLoading(false);
    }
  };

  const handleCompleteVideoKyc = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await completeVideoKyc({ app_id: app.id });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError("Could not complete Video KYC.");
      setLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await disburse({ app_id: app.id });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError("Disbursement failed.");
      setLoading(false);
    }
  };

  const handleRecordRepayment = async () => {
    if (!app?.id) return;
    try {
      setLoading(true);
      await recordRepayment({
        app_id: app.id,
        late_fee: repaymentLateFee ? Number(repaymentLateFee) : 0,
      });
      await refreshApp();
    } catch (e) {
      console.error(e);
      setError("Repayment recording failed.");
      setLoading(false);
    }
  };

  const stage = app?.current_stage;

  if (loading && !app) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p data-testid="journey-loading">Loading your application...</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p data-testid="journey-no-app">No active application found. Please start from home.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col md:flex-row">
      <aside className="md:w-72 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/80 p-4 space-y-4">
        <h2
          className="text-lg font-semibold"
          data-testid="journey-sidebar-title"
        >
          Salary Advance Journey
        </h2>
        <ol className="space-y-2 text-sm" data-testid="journey-steps-list">
          {[
            "Apply",
            "KYC",
            "Income Check",
            "Risk Scoring",
            "Offer",
            "Consent",
            "Video KYC",
            "Disbursement",
            "Repayment",
            "Closure",
          ].map((label) => {
            const isActive =
              (label === "Apply" && stage === "apply") ||
              (label === "KYC" && stage === "income_check") ||
              (label === "Income Check" && stage === "risk_scoring") ||
              (label === "Risk Scoring" && stage === "offer") ||
              (label === "Offer" && stage === "offer") ||
              (label === "Consent" && stage === "consent") ||
              (label === "Video KYC" && stage === "video_kyc") ||
              (label === "Disbursement" && stage === "repayment") ||
              (label === "Repayment" && stage === "repayment") ||
              (label === "Closure" && stage === "closed");

            return (
              <li
                key={label}
                className={`flex items-center gap-2 ${
                  isActive ? "text-emerald-400" : "text-slate-400"
                }`}
                data-testid={`journey-step-${label.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-current" />
                <span>{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p data-testid="journey-app-id">Application ID: {app.id}</p>
          <p data-testid="journey-current-stage">Current stage: {stage}</p>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto">
        {error && (
          <div
            className="text-sm text-red-400"
            data-testid="journey-error-message"
          >
            {error}
          </div>
        )}

        {/* KYC step */}
        {stage === "apply" || stage === "income_check" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="kyc-step-section"
          >
            <h3 className="text-lg font-semibold">1. KYC Verification</h3>
            <p className="text-sm text-slate-300">
              Enter your PAN, Aadhaar and confirm selfie capture. All KYC
              verifications are simulated for this demo.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm">PAN</label>
                <input
                  type="text"
                  value={kyc.pan}
                  onChange={(e) => setKyc({ ...kyc, pan: e.target.value })}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="ABCDE1234F"
                  data-testid="kyc-pan-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Aadhaar</label>
                <input
                  type="text"
                  value={kyc.aadhaar}
                  onChange={(e) => setKyc({ ...kyc, aadhaar: e.target.value })}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="12-digit Aadhaar number"
                  data-testid="kyc-aadhaar-input"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm">Selfie URL (optional for demo)</label>
                <input
                  type="text"
                  value={kyc.selfieUrl}
                  onChange={(e) =>
                    setKyc({ ...kyc, selfieUrl: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Paste image URL or leave blank"
                  data-testid="kyc-selfie-url-input"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmitKyc}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="kyc-submit-button"
            >
              {loading ? "Submitting KYC..." : "Verify KYC & Continue"}
            </button>
          </section>
        ) : null}

        {/* Income step */}
        {stage === "income_check" || stage === "risk_scoring" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="income-step-section"
          >
            <h3 className="text-lg font-semibold">2. Income Check</h3>
            <p className="text-sm text-slate-300">
              Share your employer and salary details. Income stability is
              evaluated on the last few months of salary credits.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm">Employer name</label>
                <input
                  type="text"
                  value={income.employer_name}
                  onChange={(e) =>
                    setIncome({ ...income, employer_name: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Acme Pvt Ltd"
                  data-testid="income-employer-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Average net monthly salary (₹)</label>
                <input
                  type="number"
                  value={income.avg_net_salary}
                  onChange={(e) =>
                    setIncome({ ...income, avg_net_salary: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. 50000"
                  data-testid="income-salary-input"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm">
                  Salary credit dates (comma separated, e.g. 1st Jan, 1st Feb)
                </label>
                <input
                  type="text"
                  value={income.salary_credit_dates}
                  onChange={(e) =>
                    setIncome({
                      ...income,
                      salary_credit_dates: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="List your last few salary dates"
                  data-testid="income-dates-input"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmitIncome}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="income-submit-button"
            >
              {loading ? "Submitting income details..." : "Submit Income & Continue"}
            </button>
          </section>
        ) : null}

        {/* Risk & Offer step */}
        {stage === "risk_scoring" || stage === "offer" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="risk-offer-step-section"
          >
            <h3 className="text-lg font-semibold">3. Risk Scoring & Offer</h3>
            <p className="text-sm text-slate-300">
              We simulate a bureau pull (CIBIL / Experian / CRIF) and internal
              risk rules to compute your eligible salary advance.
            </p>
            <button
              type="button"
              onClick={handleRiskAndOffer}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="risk-offer-generate-button"
            >
              {loading
                ? "Running risk checks..."
                : "Run Risk Checks & Generate Offer"}
            </button>

            {app.offer?.amount && (
              <div
                className="mt-4 grid gap-4 md:grid-cols-2 bg-slate-950/60 border border-slate-800 rounded-xl p-4"
                data-testid="offer-breakdown-card"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Loan Amount
                  </h4>
                  <p className="text-xl font-bold text-emerald-400">
                    ₹ {app.offer.amount.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Processing Fee
                  </h4>
                  <p className="text-base text-slate-100">
                    ₹ {app.offer.processing_fee.toLocaleString("en-IN")} (2%)
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Interest Rate (Annual)
                  </h4>
                  <p className="text-base text-slate-100">
                    {app.offer.interest_rate_annual}% p.a.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Repayment Date
                  </h4>
                  <p className="text-base text-slate-100">
                    {new Date(app.offer.repayment_date).toLocaleDateString(
                      "en-IN",
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* Consent step */}
        {stage === "offer" || stage === "consent" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="consent-step-section"
          >
            <h3 className="text-lg font-semibold">4. Customer Consent</h3>
            <p className="text-sm text-slate-300">
              Please review the offer, risk disclosures and provide your consent
              in Hindi + English.
            </p>
            <div
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs space-y-2 max-h-40 overflow-y-auto"
              data-testid="consent-declaration-text"
            >
              <p>
                English: I hereby confirm that the information provided is true
                and correct. I authorise Rupey to access my credit bureau data,
                validate my KYC and process this salary advance as per the
                displayed terms.
              </p>
              <p>
                हिंदी: मैं यह घोषणा करता/करती हूं कि मेरे द्वारा दी गई सभी
                जानकारी सही और सत्य है। मैं रूपे को मेरा क्रेडिट ब्यूरो डेटा
                देखने, केवाईसी सत्यापित करने और दर्शाई गई शर्तों के अनुसार यह
                सैलरी एडवांस प्रोसेस करने के लिए अधिकृत करता/करती हूं।
              </p>
            </div>
            <button
              type="button"
              onClick={handleAcceptOffer}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="consent-accept-button"
            >
              {loading ? "Recording consent..." : "I Agree & Continue"}
            </button>
          </section>
        ) : null}

        {/* Video KYC step */}
        {stage === "consent" || stage === "video_kyc" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="video-kyc-step-section"
          >
            <h3 className="text-lg font-semibold">5. Video KYC (Demo)</h3>
            <p className="text-sm text-slate-300">
              In production, this would be a live video KYC journey. For this
              demo, we simply mark Video KYC as completed.
            </p>
            <button
              type="button"
              onClick={handleCompleteVideoKyc}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="video-kyc-complete-button"
            >
              {loading ? "Completing Video KYC..." : "Mark Video KYC Complete"}
            </button>
          </section>
        ) : null}

        {/* Disbursement step */}
        {stage === "video_kyc" || stage === "repayment" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="disbursement-step-section"
          >
            <h3 className="text-lg font-semibold">6. Disbursement</h3>
            <p className="text-sm text-slate-300">
              We simulate instant NEFT / IMPS / UPI transfer to your salary
              account once all checks are completed.
            </p>
            <button
              type="button"
              onClick={handleDisburse}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="disbursement-button"
            >
              {loading ? "Processing disbursement..." : "Disburse Salary Advance"}
            </button>

            {app.disbursement?.status === "done" && (
              <div
                className="mt-4 text-sm text-slate-200 space-y-1"
                data-testid="disbursement-summary"
              >
                <p>
                  Amount credited: ₹
                  {" "}
                  {app.disbursement.amount?.toLocaleString("en-IN")} to your
                  bank account.
                </p>
                <p>Reference ID: {app.disbursement.reference_id}</p>
              </div>
            )}
          </section>
        ) : null}

        {/* Repayment & Closure step */}
        {stage === "repayment" || stage === "closed" ? (
          <section
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
            data-testid="repayment-step-section"
          >
            <h3 className="text-lg font-semibold">
              7. Repayment & Loan Closure
            </h3>
            <p className="text-sm text-slate-300">
              We show your repayment due date, and you can simulate auto debit
              or manual payment to close the salary advance.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm text-slate-200">
                <p>
                  Repayment date:
                  {" "}
                  <span data-testid="repayment-due-date">
                    {app.repayment?.due_date
                      ? new Date(app.repayment.due_date).toLocaleDateString(
                          "en-IN",
                        )
                      : "TBD"}
                  </span>
                </p>
                <p>
                  Current repayment status:
                  {" "}
                  <span data-testid="repayment-status">
                    {app.repayment?.status}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm">
                  Late fee (₹, optional for demo collections testing)
                </label>
                <input
                  type="number"
                  value={repaymentLateFee}
                  onChange={(e) => setRepaymentLateFee(e.target.value)}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. 0 or 500"
                  data-testid="repayment-late-fee-input"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRecordRepayment}
              disabled={loading || app.repayment?.status === "paid"}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
              data-testid="repayment-record-button"
            >
              {loading ? "Recording repayment..." : "Mark Repayment Received"}
            </button>

            {stage === "closed" && (
              <div
                className="mt-4 text-sm text-emerald-400 font-medium"
                data-testid="loan-closed-message"
              >
                Loan closed successfully. Thank you for using our salary advance
                product.
              </div>
            )}
          </section>
        ) : null}

        {/* Timeline */}
        <section
          className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
          data-testid="timeline-section"
        >
          <h3 className="text-lg font-semibold">Journey Timeline</h3>
          {app.timeline && app.timeline.length > 0 ? (
            <ol className="space-y-2 text-sm" data-testid="timeline-list">
              {app.timeline.map((event) => (
                <li
                  key={`${event.step}-${event.timestamp}`}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border-b border-slate-800/60 pb-2 last:border-none"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-100">{event.step}</p>
                    <p className="text-slate-300 text-xs">{event.status}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(event.timestamp).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-400">No events recorded yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
function AdminLogin() {
  const [email, setEmail] = useState("jmddatasheet@gmail.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.post("/admin/login", { email, password });
      if (res.data?.success) {
        navigate("/admin/applications");
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-xl font-semibold" data-testid="admin-login-title">
          Admin Login
        </h1>
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="admin-email-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="admin-password-input"
          />
        </div>
        {error && (
          <div
            className="text-sm text-red-400"
            data-testid="admin-login-error"
          >
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors"
          data-testid="admin-login-button"
        >
          {loading ? "Logging in..." : "Login as Admin"}
        </button>
      </div>
    </div>
  );
}

function AdminApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await api.get("/admin/applications");
        setApps(res.data?.applications || []);
      } catch (e) {
        console.error(e);
        setError("Could not load applications.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p data-testid="admin-applications-loading">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <h1
        className="text-xl font-semibold mb-4"
        data-testid="admin-applications-title"
      >
        Salary Advance Applications (Admin View)
      </h1>
      {error && (
        <div
          className="text-sm text-red-400 mb-4"
          data-testid="admin-applications-error"
        >
          {error}
        </div>
      )}
      {apps.length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="admin-no-applications">
          No applications found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="min-w-full text-sm border border-slate-800 rounded-xl overflow-hidden"
            data-testid="admin-applications-table"
          >
            <thead className="bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  ID
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  Applicant
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  Employer (Dept/Post)
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  Stage
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  Amount
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-800">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="odd:bg-slate-900/40">
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.id}
                  </td>
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.applicant_name || "-"}
                  </td>
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.income?.employer_name || "-"}
                  </td>
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.current_stage}
                  </td>
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.offer?.amount ? `₹ ${a.offer.amount}` : "-"}
                  </td>
                  <td className="px-3 py-2 border-t border-slate-800">
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString("en-IN")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-8">
        <AdminEmployees />
      </div>
    </div>
  );
}

function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    department: "",
    post: "",
    email: "",
    phone: "",
    salary: "",
    joining_date: "",
    resignation_date: "",
    last_working_date: "",
    address: "",
    status: "active",
    photo_url: "",
  });

  const loadEmployees = async () => {
    try {
      setError("");
      const res = await api.get("/admin/employees");
      setEmployees(res.data?.employees || []);
    } catch (e) {
      console.error(e);
      setError("Could not load employees.");
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      await api.post("/admin/employees", {
        ...form,
        salary: form.salary ? Number(form.salary) : undefined,
      });
      setForm({
        name: "",
        department: "",
        post: "",
        email: "",
        phone: "",
        salary: "",
        joining_date: "",
        resignation_date: "",
        last_working_date: "",
        address: "",
        status: "active",
        photo_url: "",
      });
      await loadEmployees();
    } catch (e) {
      console.error(e);
      setError("Could not add employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
      data-testid="admin-employees-section"
    >
      <h2 className="text-lg font-semibold">Employees (Department & Post)</h2>
      <p className="text-sm text-slate-300">
        Add employees department-wise and post-wise with full details.
      </p>

      {error && (
        <div
          className="text-sm text-red-400"
          data-testid="admin-employees-error"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="employee-name-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => handleChange("department", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. Credit, Collections"
            data-testid="employee-department-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Post</label>
          <input
            type="text"
            value={form.post}
            onChange={(e) => handleChange("post", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. Credit Manager, Agent"
            data-testid="employee-post-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="employee-email-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="employee-phone-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Salary (₹)</label>
          <input
            type="number"
            value={form.salary}
            onChange={(e) => handleChange("salary", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="employee-salary-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Joining Date</label>
          <input
            type="text"
            value={form.joining_date}
            onChange={(e) => handleChange("joining_date", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. 01-04-2025"
            data-testid="employee-joining-date-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Resignation Date</label>
          <input
            type="text"
            value={form.resignation_date}
            onChange={(e) => handleChange("resignation_date", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. 15-05-2025"
            data-testid="employee-resignation-date-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Last Working Date</label>
          <input
            type="text"
            value={form.last_working_date}
            onChange={(e) => handleChange("last_working_date", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. 31-05-2025"
            data-testid="employee-last-working-date-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Status</label>
          <select
            value={form.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="employee-status-select"
          >
            <option value="active">Active</option>
            <option value="abscond">Abscond</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
            <option value="death">Death</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm">Photo URL</label>
          <input
            type="text"
            value={form.photo_url}
            onChange={(e) => handleChange("photo_url", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Paste employee photo URL"
            data-testid="employee-photo-url-input"
          />
        </div>
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            rows={2}
            data-testid="employee-address-input"
          />
        </div>
      </div>

                  <td className="px-3 py-2 border-t border-slate-800">
                      {emp.status || "active"}
                    </td>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
        data-testid="employee-submit-button"
      >
        {loading ? "Adding employee..." : "Add Employee"}
      </button>

      <div className="mt-6">
        <h3 className="text-md font-semibold mb-2">Employee List</h3>
        {employees.length === 0 ? (
          <p
            className="text-sm text-slate-400"
            data-testid="employee-list-empty"
          >
            No employees added yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="min-w-full text-sm border border-slate-800 rounded-xl overflow-hidden"
              data-testid="employee-list-table"
            >
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-slate-800">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left border-b border-slate-800">
                    Department
                  </th>
                  <th className="px-3 py-2 text-left border-b border-slate-800">
                    Post
                  </th>
                  <th className="px-3 py-2 text-left border-b border-slate-800">
                    Phone
                  </th>
                  <th className="px-3 py-2 text-left border-b border-slate-800">
                    Salary
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="odd:bg-slate-900/40">
                    <td className="px-3 py-2 border-t border-slate-800">
                      {emp.name}
                    </td>
                    <td className="px-3 py-2 border-t border-slate-800">
                      {emp.department}
                    </td>
                    <td className="px-3 py-2 border-t border-slate-800">
                      {emp.post}
                    </td>
                    <td className="px-3 py-2 border-t border-slate-800">
                      {emp.phone || "-"}
                    </td>
                    <td className="px-3 py-2 border-t border-slate-800">
                      {emp.salary ? `₹ ${emp.salary}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/applications" element={<AdminApplications />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
