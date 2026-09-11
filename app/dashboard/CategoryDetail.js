"use client";

import { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";

const ALL_CATEGORIES = [
  "Spam",
  "Promotions",
  "Newsletter",
  "Social",
  "OTP & Security",
  "Transactions",
  "Receipts",
  "Finance",
  "Work",
  "Personal",
  "Notifications",
  "Travel",
  "Uncertain",
  "Jobs & Careers",
];

const ACTION_BUTTONS = {
  label: {
    label: "🏷️ Label",
    color: "#0f766e",
    backgroundColor: "#e0e7ff",
    border: "1px solid #5eead4",
  },
  archive: {
    label: "📦 Archive",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    border: "1px solid #fcd34d",
  },
  trash: {
    label: "🗑️ Trash",
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    border: "1px solid #fca5a5",
  },
};

const HIGH_RISK_CATEGORIES = [
  "Finance",
  "Work",
  "Personal",
  "Receipts",
  "Travel",
  "Transactions",
];

const SOURCE_LABELS = {
  rules: { label: "Auto-sorted", color: "#1d4ed8", bg: "#dbeafe" },
  domain: { label: "Auto-sorted", color: "#1d4ed8", bg: "#dbeafe" },
  ai: { label: "AI-sorted", color: "#0f766e", bg: "#f0fdfa" },
  user: { label: "You sorted", color: "#166534", bg: "#dcfce7" },
};

// Parses sender name and email from "Name <email@domain.com>"
function parseSender(from) {
  if (!from) return { name: "Unknown", email: "" };
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, "").trim(),
      email: match[2].trim(),
    };
  }
  return { name: from, email: from };
}

// Formats date string into readable format
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Days between now and an email's date header. Returns null if unparseable.
function getEmailAgeInDays(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
}

// 🟢 under 1 month, 🟡 1–12 months, 🔴 over 1 year — lets users eyeball
// "is this safe to clean" without mentally computing dates themselves.
function getAgeBadge(dateStr) {
  const days = getEmailAgeInDays(dateStr);
  if (days === null) return null;
  if (days < 30) return { emoji: "🟢", label: "Recent" };
  if (days < 365) return { emoji: "🟡", label: "1–12 months old" };
  return { emoji: "🔴", label: "Over a year old" };
}

const DATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "recent", label: "Last 3 months" },
  { key: "mid", label: "3–12 months" },
  { key: "old", label: "Older than 1 year" },
];

function getUnsubscribeUrl(headers) {
  const header = headers?.["list-unsubscribe"];
  if (!header) return null;
  // Header format: "<https://unsubscribe.url>, <mailto:...>"
  // Extract the https URL
  const match = header.match(/<(https?:\/\/[^>]+)>/);
  if (!match) {
    return null;
  }
  const url = match[1];
  // Skip URLs that look like API endpoints rather than user-facing pages.
  // These return raw JSON when opened in a browser, which is confusing.
  const apiPatterns = [
    /\/api\//i,
    /\.json(\?|$)/i,
    /\/v\d+\//i,
    /\/oneclick/i,
    /\/unsubscribe\/api/i,
  ];

  if (apiPatterns.some((pattern) => pattern.test(url))) {
    return null;
  }

  return url;
}

// for grouping the emails

// Extract domain from sender email
function extractSenderDomain(from) {
  if (!from) return "Unknown";
  const match = from.match(/@([^>>\s]+)/);
  if (!match) return from;
  // Get base domain — strip subdomains
  // e.g. em123.newsletter.amazon.com → amazon.com
  const parts = match[1].toLowerCase().split(".");
  if (parts.length > 2) {
    return parts.slice(-2).join(".");
  }
  return match[1].toLowerCase();
}

// Get display name for a domain
function getDomainDisplayName(domain) {
  // Capitalise first part of domain
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Group emails by sender domain
function groupEmailsByDomain(emails) {
  const groups = {};
  emails.forEach((email) => {
    const domain = extractSenderDomain(email.from);
    if (!groups[domain]) {
      groups[domain] = {
        domain,
        displayName: getDomainDisplayName(domain),
        emails: [],
      };
    }
    groups[domain].emails.push(email);
  });
  // Sort groups by email count descending
  return Object.values(groups).sort(
    (a, b) => b.emails.length - a.emails.length,
  );
}

export default function CategoryDetail({
  category,
  onBack,
  onCategoryOverride,
  onActionComplete,
  onStatsRefresh,
  onCountRefresh,
}) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [overriding, setOverriding] = useState(null); // messageId being overridden
  const [error, setError] = useState(null);
  // group is null for a whole-category action, or { domain, emails } when
  // the modal was opened from a sender-group's action buttons instead
  const [modal, setModal] = useState({ isOpen: false, action: null, group: null });
  const [actioning, setActioning] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [groupActioning, setGroupActioning] = useState(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  //const [groupActioning, setGroupActioning] = useState(null)
  const [openGroupMenu, setOpenGroupMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'recent' | 'mid' | 'old'
  const isHighRisk = HIGH_RISK_CATEGORIES.includes(category);

  // Client-side only — filters whatever page(s) are currently loaded, same
  // limitation as pagination itself. No API call needed for either filter.
  const visibleEmails = emails.filter((email) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchesSender = (email.from || "").toLowerCase().includes(q);
      const matchesSubject = (email.subject || "").toLowerCase().includes(q);
      if (!matchesSender && !matchesSubject) return false;
    }
    if (dateFilter !== "all") {
      const days = getEmailAgeInDays(email.date);
      if (days === null) return false;
      if (dateFilter === "recent" && !(days < 90)) return false;
      if (dateFilter === "mid" && !(days >= 90 && days < 365)) return false;
      if (dateFilter === "old" && !(days >= 365)) return false;
    }
    return true;
  });
  const isFiltering = searchQuery.trim() !== "" || dateFilter !== "all";

  useEffect(() => {
    fetchEmails(1);
  }, [category]);

  async function fetchEmails(pageNum) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/emails?category=${encodeURIComponent(category)}&page=${pageNum}`,
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (pageNum === 1) {
        setEmails(data.emails);
      } else {
        // Append for "load more"
        setEmails((prev) => [...prev, ...data.emails]);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeGroupLabel(domain, groupEmails) {
    try {
      setModal({ isOpen: false, action: null, group: null });
      setGroupActioning(domain);
      setOpenGroupMenu(null);

      const messageIds = groupEmails.map((e) => e.messageId);

      const res = await fetch("/api/emails/group-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "label", messageIds, category }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEmails((prev) =>
        prev.filter((e) => !messageIds.includes(e.messageId)),
      );
      setTotal((prev) => prev - messageIds.length);
      onActionComplete(category);
      onStatsRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setGroupActioning(null);
    }
  }

  async function executeGroupMove(domain, groupEmails, newCategory) {
    try {
      setGroupActioning(domain);
      setOpenGroupMenu(null);

      const messageIds = groupEmails.map((e) => e.messageId);

      // Move each email — no bulk move endpoint, so we fire them in parallel
      await Promise.all(
        messageIds.map((messageId) =>
          fetch(`/api/emails/${messageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: newCategory }),
          }),
        ),
      );

      setEmails((prev) =>
        prev.filter((e) => !messageIds.includes(e.messageId)),
      );
      setTotal((prev) => prev - messageIds.length);

      // Update summary counts — one call per email moved
      messageIds.forEach(() => onCategoryOverride(category, newCategory));
    } catch (err) {
      setError(err.message);
    } finally {
      setGroupActioning(null);
    }
  }

  async function overrideCategory(messageId, newCategory) {
    try {
      setOverriding(messageId);
      const res = await fetch(`/api/emails/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Update the email list
      setEmails((prev) => prev.filter((e) => e.messageId !== messageId));
      setTotal((prev) => prev - 1);

      // Tell parent to update the summary counts
      onCategoryOverride(category, newCategory);
    } catch (err) {
      setError(err.message);
    } finally {
      setOverriding(null);
    }
  }

  async function executeAction(action) {
    try {
      setActioning(true);
      setModal({ isOpen: false, action: null });
      setError(null);

      const res = await fetch("/api/emails/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, category }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setActionResult(data);
      // Clear the email list since they've been actioned
      setEmails([]);
      setTotal(0);
      onActionComplete(category);
      onStatsRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioning(false);
    }
  }

  async function executeGroupAction(action, domain, groupEmails) {
    try {
      setModal({ isOpen: false, action: null, group: null });
      setGroupActioning(domain);

      const messageIds = groupEmails.map((e) => e.messageId);

      const res = await fetch("/api/emails/group-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, messageIds, category }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Remove actioned emails from the list
      setEmails((prev) =>
        prev.filter((e) => !messageIds.includes(e.messageId)),
      );
      setTotal((prev) => prev - messageIds.length);
      onActionComplete(category);
      onStatsRefresh();
      onCountRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setGroupActioning(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {category}
                </h2>
                <p className="text-sm text-gray-400">
                  {isFiltering
                    ? `${visibleEmails.length} match your filter (${emails.length} loaded, ${total} total)`
                    : emails.length > 0
                      ? `Showing ${emails.length} of ${total} emails`
                      : `${total} emails`}
                </p>
                <p className="text-xs text-gray-400 italic mt-1">
                  Reclassifying only changes how Sweepyr sorts an email — it doesn't move it in Gmail.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Group toggle button */}
              {emails.length > 0 && !actionResult && (
                <button
                  onClick={() => {
                    setIsGrouped((prev) => !prev);
                    setExpandedGroups({}); // collapse all when toggling
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: isGrouped ? "#0d9488" : "#6b7280",
                    backgroundColor: isGrouped ? "#f0fdfa" : "#f9fafb",
                    border: isGrouped
                      ? "1px solid #5eead4"
                      : "1px solid #e5e7eb",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isGrouped ? "⊞ Ungroup" : "⊞ Group by Sender"}
                </button>
              )}

              {/* Existing action buttons */}
              {total > 0 && !actionResult && !actioning && (
                <div style={{ display: "flex", gap: "8px" }}>
                  {["label", "archive", "trash"].map((action) => {
                    const btn = ACTION_BUTTONS[action];
                    const isTrashHighRisk = action === "trash" && isHighRisk;
                    const tooltip = {
                      label: `Adds a Sweepyr/${category} label in Gmail. Emails stay in your inbox.`,
                      archive: "Removes from inbox, keeps in All Mail. Findable anytime via search.",
                      trash: "Moves to Gmail Trash. Recoverable for 30 days.",
                    }[action];
                    return (
                      <button
                        key={action}
                        onClick={() => setModal({ isOpen: true, action })}
                        title={tooltip}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "500",
                          color: isTrashHighRisk ? "#ffffff" : btn.color,
                          backgroundColor: isTrashHighRisk
                            ? "#dc2626"
                            : btn.backgroundColor,
                          border: isTrashHighRisk
                            ? "1px solid #b91c1c"
                            : btn.border,
                          borderRadius: "8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {actioning && (
                <p className="text-sm text-gray-400">Processing...</p>
              )}
            </div>
          </div>

          {/* Search + date filter */}
          {emails.length > 0 && !actionResult && (
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by sender or subject..."
                style={{
                  flex: "1 1 220px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#374151",
                }}
              />
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setDateFilter(f.key)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: "500",
                      color: dateFilter === f.key ? "#0d9488" : "#6b7280",
                      backgroundColor:
                        dateFilter === f.key ? "#f0fdfa" : "#f9fafb",
                      border:
                        dateFilter === f.key
                          ? "1px solid #5eead4"
                          : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* High risk warning */}
          {isHighRisk && (
            <div
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                backgroundColor: "#fef9c3",
                border: "1px solid #fde047",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#854d0e",
              }}
            >
              ⚠️ This category may contain important emails. Review carefully
              before taking action.
            </div>
          )}
        </div>

        {/* Action Result */}
        {actionResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-700 text-sm font-medium">
              ✓ {actionResult.affected} emails{" "}
              {actionResult.action === "trash"
                ? "moved to Trash"
                : actionResult.action === "archive"
                  ? "archived"
                  : "labelled"}{" "}
              successfully.
              {actionResult.action === "trash" &&
                " They'll stay in Trash for 30 days."}
              {actionResult.action === "archive" &&
                " Find them anytime in All Mail."}
            </p>
          </div>
        )}

        {/* Email List */}
        {loading && emails.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Loading emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">No emails in this category.</p>
          </div>
        ) : visibleEmails.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">
              No emails match your search or filter.
            </p>
          </div>
        ) : isGrouped ? (
          // ─── Grouped View ─────────────────────────────────────────
          <div className="space-y-2">
            {groupEmailsByDomain(visibleEmails).map((group) => {
              const isExpanded = expandedGroups[group.domain];
              const isActioning = groupActioning === group.domain;

              return (
                <div
                  key={group.domain}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    position: 'relative',
                    zIndex: openGroupMenu === group.domain ? 30 : 1,
                  }}
                >
                  {/* Group header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#f9fafb',
                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                    borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                    position: 'relative',
                  }}>
                    {/* Left — domain info */}
                    <button
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [group.domain]: !prev[group.domain],
                        }))
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0",
                        flex: 1,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <div>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          {group.displayName}
                        </p>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "12px",
                            color: "#6b7280",
                          }}
                        >
                          {group.domain} · {group.emails.length} email
                          {group.emails.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>

                    {/* Right — group action buttons */}
                    {!isActioning ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexShrink: 0,
                          position: "relative",
                        }}
                      >
                        <button
                          onClick={() =>
                            setModal({
                              isOpen: true,
                              action: "archive",
                              group: { domain: group.domain, emails: group.emails },
                            })
                          }
                          title={`Archives all ${group.emails.length} emails from ${group.domain}. Removes from inbox, keeps in All Mail — findable anytime via search.`}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: "500",
                            color: "#92400e",
                            backgroundColor: "#fef3c7",
                            border: "1px solid #fcd34d",
                            borderRadius: "6px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          📦 Archive
                        </button>

                        <button
                          onClick={() =>
                            setModal({
                              isOpen: true,
                              action: "trash",
                              group: { domain: group.domain, emails: group.emails },
                            })
                          }
                          title={`Moves all ${group.emails.length} emails from ${group.domain} to Gmail Trash. Recoverable for 30 days.`}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: "500",
                            color: isHighRisk ? "#ffffff" : "#991b1b",
                            backgroundColor: isHighRisk ? "#dc2626" : "#fee2e2",
                            border: isHighRisk
                              ? "1px solid #b91c1c"
                              : "1px solid #fca5a5",
                            borderRadius: "6px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          🗑️ Trash
                        </button>

                        <button
                          onClick={() =>
                            setOpenGroupMenu(
                              openGroupMenu === group.domain
                                ? null
                                : group.domain,
                            )
                          }
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#6b7280",
                            backgroundColor: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          •••
                        </button>

                        {/* Overflow menu */}
                        {openGroupMenu === group.domain && (
                          <>
                            {/* Click-outside catcher */}
                            <div
                              onClick={() => setOpenGroupMenu(null)}
                              style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 100,
                              }}
                            />

                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '4px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              zIndex: 101,
                              minWidth: '180px',
                              padding: '4px',
                            }}>
                              <button
                                onClick={() => {
                                  setOpenGroupMenu(null);
                                  setModal({
                                    isOpen: true,
                                    action: "label",
                                    group: { domain: group.domain, emails: group.emails },
                                  });
                                }}
                                title={`Adds a Sweepyr/${category} label in Gmail to all ${group.emails.length} emails from ${group.domain}. Emails stay in your inbox.`}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "8px 10px",
                                  fontSize: "12px",
                                  backgroundColor: "transparent",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  color: "#374151",
                                }}
                              >
                                🏷️ Label all {group.emails.length}
                              </button>

                              <div
                                style={{
                                  height: "1px",
                                  backgroundColor: "#f3f4f6",
                                  margin: "4px 0",
                                }}
                              />

                              <p
                                title="Changes how Sweepyr sorts these emails. Nothing changes in Gmail."
                                style={{
                                  margin: "0",
                                  padding: "4px 10px",
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  fontWeight: "600",
                                }}
                              >
                                Reclassify all as
                              </p>

                              <div
                                style={{
                                  maxHeight: "180px",
                                  overflowY: "auto",
                                }}
                              >
                                {ALL_CATEGORIES.filter(
                                  (c) => c !== category,
                                ).map((c) => (
                                  <button
                                    key={c}
                                    onClick={() =>
                                      executeGroupMove(
                                        group.domain,
                                        group.emails,
                                        c,
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "6px 10px",
                                      fontSize: "12px",
                                      backgroundColor: "transparent",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      color: "#374151",
                                    }}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Processing...
                      </span>
                    )}
                  </div>

                  {/* Expanded email list */}
                  {isExpanded && (
                    <div>
                      {group.emails.map((email) => {
                        const sender = parseSender(email.from);
                        const source =
                          SOURCE_LABELS[email.classificationSource] ||
                          SOURCE_LABELS.ai;
                        const isOverriding = overriding === email.messageId;
                        const unsubUrl = getUnsubscribeUrl(email.headers);

                        return (
                          <div
                            key={email.messageId}
                            style={{
                              padding: "12px 16px",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "start",
                                justifyContent: "space-between",
                                gap: "12px",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {email.hasAttachment && (
                                    <span
                                      style={{
                                        fontSize: "12px",
                                        color: "#9ca3af",
                                      }}
                                      title="Has attachment"
                                    >
                                      📎
                                    </span>
                                  )}
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      padding: "2px 8px",
                                      borderRadius: "999px",
                                      fontWeight: "500",
                                      backgroundColor: source.bg,
                                      color: source.color,
                                    }}
                                  >
                                    {source.label}
                                  </span>
                                </div>
                                <p
                                  style={{
                                    margin: "0 0 4px 0",
                                    fontSize: "13px",
                                    color: "#374151",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {email.subject || "(no subject)"}
                                </p>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {getAgeBadge(email.date) && (
                                    <span title={getAgeBadge(email.date).label} style={{ fontSize: "11px" }}>
                                      {getAgeBadge(email.date).emoji}
                                    </span>
                                  )}
                                  <p
                                    style={{
                                      margin: "0",
                                      fontSize: "11px",
                                      color: "#9ca3af",
                                    }}
                                  >
                                    {formatDate(email.date)}
                                    {email.confidence > 0 && (
                                      <span style={{ marginLeft: "8px" }}>
                                        {Math.round(email.confidence * 100)}%
                                        confident
                                      </span>
                                    )}
                                  </p>
                                  {(category === "Newsletter" ||
                                    category === "Promotions") &&
                                    unsubUrl && (
                                      <a
                                        href={unsubUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          fontSize: "11px",
                                          color: "#6b7280",
                                          border: "1px solid #e5e7eb",
                                          borderRadius: "4px",
                                          padding: "1px 8px",
                                          textDecoration: "none",
                                          backgroundColor: "#f9fafb",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        Unsubscribe
                                      </a>
                                    )}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {isOverriding ? (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#9ca3af",
                                    }}
                                  >
                                    Reclassifying...
                                  </span>
                                ) : (
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value)
                                        overrideCategory(
                                          email.messageId,
                                          e.target.value,
                                        );
                                    }}
                                    title="Changes how Sweepyr sorts this email. Nothing changes in Gmail."
                                    style={{
                                      fontSize: "12px",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: "6px",
                                      padding: "4px 8px",
                                      color: "#6b7280",
                                      backgroundColor: "#ffffff",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <option value="" disabled>
                                      Reclassify...
                                    </option>
                                    {ALL_CATEGORIES.filter(
                                      (c) => c !== category,
                                    ).map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // ─── Flat View (existing) ──────────────────────────────────
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {visibleEmails.map((email) => {
              const sender = parseSender(email.from);
              const source =
                SOURCE_LABELS[email.classificationSource] || SOURCE_LABELS.ai;
              const isOverriding = overriding === email.messageId;
              const unsubUrl = getUnsubscribeUrl(email.headers);

              return (
                <div
                  key={email.messageId}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {sender.name}
                        </p>
                        {email.hasAttachment && (
                          <span
                            className="text-xs text-gray-400"
                            title="Has attachment"
                          >
                            📎
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontWeight: "500",
                            backgroundColor: source.bg,
                            color: source.color,
                          }}
                        >
                          {source.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mb-1">
                        {email.subject || "(no subject)"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {getAgeBadge(email.date) && (
                          <span title={getAgeBadge(email.date).label} className="text-xs">
                            {getAgeBadge(email.date).emoji}
                          </span>
                        )}
                        <p
                          className="text-xs text-gray-400"
                          style={{ margin: 0 }}
                        >
                          {sender.email} · {formatDate(email.date)}
                          {email.confidence > 0 && (
                            <span className="ml-2">
                              {Math.round(email.confidence * 100)}% confident
                            </span>
                          )}
                        </p>
                        {(category === "Newsletter" ||
                          category === "Promotions") &&
                          unsubUrl && (
                            <a
                              href={unsubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                border: "1px solid #e5e7eb",
                                borderRadius: "4px",
                                padding: "1px 8px",
                                textDecoration: "none",
                                backgroundColor: "#f9fafb",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Unsubscribe
                            </a>
                          )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isOverriding ? (
                        <span className="text-xs text-gray-400">Reclassifying...</span>
                      ) : (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value)
                              overrideCategory(email.messageId, e.target.value);
                          }}
                          title="Changes how Sweepyr sorts this email. Nothing changes in Gmail."
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white hover:border-gray-300 transition-colors"
                        >
                          <option value="" disabled>
                            Reclassify...
                          </option>
                          {ALL_CATEGORIES.filter((c) => c !== category).map(
                            (c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <button
            onClick={() => fetchEmails(page + 1)}
            disabled={loading}
            className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more emails"}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm font-medium">Error: {error}</p>
          </div>
        )}
      </div>
      {/* Modal lives outside all divs — nothing can interfere with its positioning */}
      <ConfirmModal
        isOpen={modal.isOpen}
        action={modal.action}
        category={category}
        scopeLabel={modal.group ? `${category} — ${modal.group.domain}` : category}
        count={modal.group ? modal.group.emails.length : total}
        isHighRisk={isHighRisk}
        onConfirm={() => {
          if (modal.group) {
            if (modal.action === "label") {
              executeGroupLabel(modal.group.domain, modal.group.emails);
            } else {
              executeGroupAction(modal.action, modal.group.domain, modal.group.emails);
            }
          } else {
            executeAction(modal.action);
          }
        }}
        onCancel={() => setModal({ isOpen: false, action: null, group: null })}
      />
    </>
  );
}
