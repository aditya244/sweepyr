"use client";

import { useState, useEffect } from "react";

export default function StatsBar({ refreshKey, emailCount: emailCountProp }) {
  const [stats, setStats] = useState(null);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        setRefreshing(true);
        const statsRes = await fetch("/api/stats");
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);

        // Only fetch Gmail count if not passed from parent and not already fetched
        if (!emailCountProp && totalEmailCount === 0) {
          const countRes = await fetch("/api/gmail/count");
          const countData = await countRes.json();
          if (countData.count) setTotalEmailCount(countData.count);
        }
      } catch (err) {
        console.error("StatsBar error:", err);
      } finally {
        setRefreshing(false);
      }
    }
    loadStats();
  }, [refreshKey]);

  if (!stats || stats.totalSorted === 0) return null;

  // Use prop if available, otherwise use locally fetched count
  const displayCount = emailCountProp || totalEmailCount;

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "16px",
            marginTop: "0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Your Progress
          {refreshing && (
            <span
              style={{
                width: "10px",
                height: "10px",
                border: "2px solid #e5e7eb",
                borderTopColor: "#6b7280",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
        </p>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom:
              displayCount > 0 && stats.totalCleaned > 0 ? "24px" : "0",
          }}
        >
          {[
            { value: stats.totalSorted, label: "📧 Sorted", color: "#111827" },
            { value: stats.trashed, label: "🗑️ Trashed", color: "#dc2626" },
            { value: stats.archived, label: "📦 Archived", color: "#d97706" },
            { value: stats.labelled, label: "🏷️ Labelled", color: "#0d9488" },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: item.color,
                  margin: "0 0 4px 0",
                }}
              >
                {item.value.toLocaleString()}
              </p>
              <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Progress bar — measured against emails scanned, not entire inbox */}
        {stats.totalSorted > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                {stats.totalCleaned.toLocaleString()} of{" "}
                {stats.totalSorted.toLocaleString()} scanned emails cleaned
              </span>
              {displayCount > 0 && (
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {displayCount.toLocaleString()} total in mailbox
                </span>
              )}
            </div>

            <div
              style={{
                width: "100%",
                backgroundColor: "#f3f4f6",
                borderRadius: "999px",
                height: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width:
                    stats.totalCleaned === 0
                      ? "0%"
                      : `${Math.max(Math.min((stats.totalCleaned / stats.totalSorted) * 100, 100), 2)}%`,
                  backgroundColor: "#0d9488",
                  height: "8px",
                  borderRadius: "999px",
                  transition: "width 0.5s ease",
                }}
              />
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginTop: "8px",
                marginBottom: "0",
              }}
            >
              {((stats.totalCleaned / stats.totalSorted) * 100).toFixed(1)}% of
              scanned emails cleaned
              {stats.totalCleaned < stats.totalSorted && (
                <span
                  style={{
                    color: "#0d9488",
                    marginLeft: "8px",
                    fontWeight: "500",
                  }}
                >
                  — {(stats.totalSorted - stats.totalCleaned).toLocaleString()}{" "}
                  left to review
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
