"use client";

import { useState, useEffect } from "react";
import ScanProgress from "./ScanProgress";

const CATEGORY_CONFIG = {
  Spam: { emoji: "🚫", risk: "red", riskLabel: "Safe to delete" },
  Promotions: { emoji: "🛍️", risk: "red", riskLabel: "Safe to delete" },
  Newsletter: { emoji: "📰", risk: "red", riskLabel: "Safe to delete" },
  Social: { emoji: "💬", risk: "orange", riskLabel: "Usually safe" },
  "OTP & Security": {
    emoji: "🔐",
    risk: "orange",
    riskLabel: "Delete after use",
  },
  Transactions: { emoji: "💳", risk: "yellow", riskLabel: "Keep short term" },
  Receipts: { emoji: "🧾", risk: "yellow", riskLabel: "Keep short term" },
  Finance: { emoji: "🏦", risk: "green", riskLabel: "Keep" },
  Work: { emoji: "👔", risk: "green", riskLabel: "Keep — real work emails" },
  Personal: { emoji: "👤", risk: "green", riskLabel: "Keep" },
  Notifications: { emoji: "🔔", risk: "orange", riskLabel: "Usually safe" },
  Travel: { emoji: "✈️", risk: "yellow", riskLabel: "Keep short term" },
  Uncertain: { emoji: "❓", risk: "yellow", riskLabel: "Needs review" },
  "Jobs & Careers": {
    emoji: "💼",
    risk: "orange",
    riskLabel: "Review — may not be relevant",
  },
};

const CATEGORY_SUGGESTIONS = {
  Spam: { action: "Trash", color: "#dc2626", bg: "#fee2e2" },
  Promotions: { action: "Trash", color: "#dc2626", bg: "#fee2e2" },
  Newsletter: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Social: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  "Jobs & Careers": { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Notifications: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  "OTP & Security": { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Transactions: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Receipts: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Travel: { action: "Archive", color: "#92400e", bg: "#fef3c7" },
  Finance: { action: "Label", color: "#166534", bg: "#dcfce7" },
  Work: { action: "Label", color: "#166534", bg: "#dcfce7" },
  Personal: { action: "Label", color: "#166534", bg: "#dcfce7" },
  Uncertain: { action: "Review", color: "#6b7280", bg: "#f3f4f6" },
};

const CATEGORY_ORDER = [
  "Spam",
  "Promotions",
  "Newsletter",
  "Social",
  "Jobs & Careers",
  "Notifications",
  "OTP & Security",
  "Uncertain",
  "Transactions",
  "Receipts",
  "Travel",
  "Finance",
  "Work",
  "Personal",
];

const RISK_BG = {
  red: "#fff1f2",
  orange: "#fff7ed",
  yellow: "#fefce8",
  green: "#f0fdf4",
};

const RISK_BORDER = {
  red: "#fecdd3",
  orange: "#fed7aa",
  yellow: "#fef08a",
  green: "#bbf7d0",
};

const RISK_TEXT = {
  red: "#b91c1c",
  orange: "#c2410c",
  yellow: "#a16207",
  green: "#15803d",
};

const TIER_BATCH_OPTIONS = {
  free:      [100],
  pro:       [100, 200, 500],
  annual:    [100, 200, 500, 1000],
  deepclean: [100, 500, 1000, 2500, 5000],
}

const TIER_LABELS = {
  free:      'Free',
  pro:       'Pro',
  annual:    'Annual',
  deepclean: 'Deep Clean',
}

export default function CategorySummary({
  onCategorySelect,
  emailCount,
  setEmailCount,
  scanning,
  setScanning,
  scanDone,
  setScanDone,
  classifying,
  setClassifying,
  classifyResult,
  setClassifyResult,
  error,
  setError,
  onAuthError,
  startScanRef,
  tier = 'free',
  usage,
  onUsageRefresh,
}) {
  const [limitReached, setLimitReached] = useState(false);
  const outOfQuota = limitReached || (usage && usage.remaining <= 0);

  async function fetchEmailCount() {
    try {
      setError(null);
      const res = await fetch("/api/gmail/count");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmailCount(data.count);
    } catch (err) {
      setError(err.message);
    }
  }

  // Register the scan function so parent can call it
  useEffect(() => {
    if (startScanRef) {
      startScanRef.current = startScanAndClassify
    }
  }, [startScanRef])

  const [progress, setProgress] = useState(null);
  const batchOptions = TIER_BATCH_OPTIONS[tier] || [100]
  const [batchSize, setBatchSize] = useState(batchOptions[batchOptions.length - 1])

  useEffect(() => {
    loadExistingSummary();
  }, []);

  async function loadExistingSummary() {
    try {
      const [summaryRes, countRes] = await Promise.all([
        fetch("/api/emails/summary"),
        fetch("/api/gmail/count"),
      ]);
      const summaryData = await summaryRes.json();
      const countData = await countRes.json();

      if (summaryData.summary) {
        setClassifyResult({
          summary: summaryData.summary,
          layerStats: summaryData.layerStats,
          classified: Object.values(summaryData.summary).reduce(
            (a, b) => a + b,
            0,
          ),
        });
        setScanDone(true);
      }

      if (countData.count) setEmailCount(countData.count);
    } catch (err) {
      console.error("Error loading summary:", err);
    }
  }

  async function startScanAndClassify() {
    try {
      setError(null);
      setLimitReached(false);
      setScanDone(false);
      setClassifyResult(null);

      // Get email count first
      const countRes = await fetch("/api/gmail/count");
      const countData = await countRes.json();
      if (countData.error) throw new Error(countData.error);
      setEmailCount(countData.count);

      if (countData.error === 'GMAIL_AUTH_EXPIRED') {
        onAuthError()
        return
      }

      // Open SSE connection
      const url = `/api/gmail/process?batchSize=${batchSize}`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error === 'USAGE_LIMIT_REACHED') {
          setLimitReached(true);
          setProgress(null);
          eventSource.close();
          return;
        }

        if (data.error === 'GMAIL_AUTH_EXPIRED') {
          onAuthError()
          eventSource.close()
          setProgress(null)
          return
        }

        if (data.error) {
          setError(data.error);
          setProgress(null);
          eventSource.close();
          return;
        }

        if (data.stage === "done") {
          setClassifyResult({
            summary: data.summary,
            layerStats: data.layerStats,
            classified: data.classified,
          });
          setScanDone(true);
          setProgress(null);
          eventSource.close();
          onUsageRefresh?.();
          return;
        }

        // Update progress
        setProgress({
          stage: data.stage,
          message: data.message,
          percent: data.percent || 0,
          progress: data.progress || 0,
          total: data.total || batchSize,
        });
      };

      eventSource.onerror = (err) => {
        console.error("SSE error:", err);
        setError("Connection lost. Please try again.");
        setProgress(null);
        eventSource.close();
      };
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  }

  // UNUSED — commented out, not deleted.
  // startScan() and startClassification() are dead code: neither is wired to
  // any onClick in this file. The dashboard's "Scan & Clean" button calls
  // startScanAndClassify() instead, which hits the combined SSE route
  // /api/gmail/process (scanning + classification with live progress).
  // These called the now-superseded /api/gmail/scan and /api/gmail/classify
  // routes (also commented out, see those files).
  //
  // async function startScan() {
  //   try {
  //     setScanning(true);
  //     setError(null);
  //     setScanDone(false);
  //     setClassifyResult(null);
  //     const res = await fetch("/api/gmail/scan", { method: "POST" });
  //     const data = await res.json();
  //     if (data.error) throw new Error(data.error);
  //     setScanDone(true);
  //   } catch (err) {
  //     setError(err.message);
  //   } finally {
  //     setScanning(false);
  //   }
  // }
  //
  // async function startClassification() {
  //   try {
  //     setClassifying(true);
  //     setError(null);
  //     const res = await fetch("/api/gmail/classify", { method: "POST" });
  //     const data = await res.json();
  //     if (data.error) throw new Error(data.error);
  //     setClassifyResult(data);
  //   } catch (err) {
  //     setError(err.message);
  //   } finally {
  //     setClassifying(false);
  //   }
  // }

  return (
  <div className="space-y-6">

    {/* Mailbox Card */}
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Mailbox</h2>
      <p className="text-gray-500 text-sm mb-6">
        We only read sender info, subject lines and headers — never the content of your emails.
      </p>

      {/* Email count */}
      {emailCount !== null && (
        <div className="mb-6">
          <p className="text-4xl font-bold text-gray-900">{emailCount.toLocaleString()}</p>
          <p className="text-gray-500 text-sm mt-1">total emails in your mailbox</p>
        </div>
      )}

      {/* Before first scan — show batch size selector */}
{!progress && !classifyResult && (
  <div style={{ marginBottom: '20px' }}>
    <p style={{
      fontSize: '12px',
      color: '#6b7280',
      marginBottom: '8px',
      marginTop: '0',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      How many emails should we scan?
      <span style={{
        fontSize: '11px',
        color: '#0f766e',
        backgroundColor: '#f0fdfa',
        padding: '2px 8px',
        borderRadius: '999px',
        fontWeight: '500',
      }}>
        {TIER_LABELS[tier]} Plan
      </span>
      {usage && (
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          {usage.used.toLocaleString()} of {usage.limit.toLocaleString()} emails used this month
        </span>
      )}
    </p>

    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {batchOptions.map(option => (
        <button
          key={option}
          onClick={() => setBatchSize(option)}
          style={{
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: '500',
            backgroundColor: batchSize === option ? '#111827' : '#f3f4f6',
            color: batchSize === option ? '#ffffff' : '#374151',
            border: batchSize === option ? '1px solid #111827' : '1px solid #e5e7eb',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {option.toLocaleString()} emails
        </button>
      ))}
    </div>

    {tier === 'free' && (
      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', marginBottom: '0' }}>
        Upgrade to Pro to scan up to 500 at once.{' '}
        <a href="/pricing" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: '500' }}>
          See plans →
        </a>
      </p>
    )}
  </div>
)}

{/* After scan — show what was scanned instead of the selector */}
{!progress && classifyResult && (
  <div style={{
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  }}>
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      backgroundColor: '#f0fdfa',
      border: '1px solid #99f6e4',
      borderRadius: '8px',
    }}>
      <span style={{ color: '#0d9488', fontSize: '14px', fontWeight: '700' }}>✓</span>
      <span style={{ fontSize: '13px', color: '#0f766e', fontWeight: '500' }}>
        {(classifyResult.classified || 0).toLocaleString()} emails scanned and sorted
      </span>
    </div>

    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
      Rescan to check for new emails
      {tier === 'free' && (
        <>
          {' · '}
          <a href="/pricing" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: '500' }}>
            Scan more with Pro →
          </a>
        </>
      )}
    </span>
  </div>
)}

      {/* Progress indicator */}
      {progress && (
        <ScanProgress
          stage={progress.stage}
          message={progress.message}
          percent={progress.percent}
          progress={progress.progress}
          total={progress.total}
        />
      )}

      {/* Scan button, or upgrade prompt if this month's quota is used up */}
      {!progress && outOfQuota ? (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#92400e',
        }}>
          You've used all {(usage?.limit ?? TIER_BATCH_OPTIONS[tier]?.[0]).toLocaleString()} emails included in your {TIER_LABELS[tier]} plan this month.{' '}
          <a href="/pricing" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: '600' }}>
            Upgrade to keep cleaning →
          </a>
        </div>
      ) : !progress && (
        <button
          onClick={startScanAndClassify}
          style={{
            padding: '10px 24px',
            backgroundColor: '#000000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {classifyResult ? (
            <><span style={{ fontSize: '14px' }}>↻</span> Rescan Emails</>
          ) : (
            <><span style={{ fontSize: '14px' }}>→</span> Scan & Clean</>
          )}
        </button>
      )}
    </div>

    {/* Classification Results */}
    {classifyResult && classifyResult.summary && (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Your Inbox Report</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Click any category to review the emails inside.
        </p>

        <div className="space-y-3">
          {Object.entries(classifyResult.summary)
            .sort((a, b) => {
              const orderA = CATEGORY_ORDER.indexOf(a[0])
              const orderB = CATEGORY_ORDER.indexOf(b[0])
              const posA = orderA === -1 ? 8 : orderA
              const posB = orderB === -1 ? 8 : orderB
              return posA - posB
            })
            .map(([category, count]) => {
              const config = CATEGORY_CONFIG[category] || { emoji: '📧', risk: 'yellow', riskLabel: 'Review' }
              return (
                <button
                  key={category}
                  onClick={() => onCategorySelect(category)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    cursor: 'pointer',
                    marginBottom: '0',
                    backgroundColor: RISK_BG[config.risk],
                    borderColor: RISK_BORDER[config.risk],
                    color: RISK_TEXT[config.risk],
                  }}
                >
                  {/* Left side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{config.emoji}</span>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: '0', fontSize: '14px', fontWeight: '500' }}>{category}</p>
                      <p style={{ margin: '0', fontSize: '12px', opacity: '0.7' }}>{config.riskLabel}</p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {CATEGORY_SUGGESTIONS[category] && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: CATEGORY_SUGGESTIONS[category].color,
                        backgroundColor: CATEGORY_SUGGESTIONS[category].bg,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        whiteSpace: 'nowrap',
                        width: '120px',
                        textAlign: 'center',
                        display: 'inline-block',
                        boxSizing: 'border-box',
                      }}>
                        Suggested: {CATEGORY_SUGGESTIONS[category].action}
                      </span>
                    )}
                    <span style={{ fontWeight: '700', fontSize: '18px', minWidth: '32px', textAlign: 'right' }}>
                      {count}
                    </span>
                    <span style={{ fontSize: '12px', opacity: '0.5' }}>→</span>
                  </div>
                </button>
              )
            })}
        </div>
      </div>
    )}

    {error && (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700 text-sm font-medium">Error: {error}</p>
      </div>
    )}

  </div>
)
}
