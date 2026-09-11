"use client";

import { useEffect, useState } from "react";

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  action,
  category,
  scopeLabel,
  count,
  isHighRisk,
}) {
  // scopeLabel describes what's being acted on in the description text —
  // defaults to the plain category, but a sender-group action passes
  // something like "Finance — noreply@hdfcbank.com" so the copy doesn't
  // read as if the whole category is being trashed
  const scope = scopeLabel || category;
  const [confirmText, setConfirmText] = useState("");

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset confirm text when modal closes
  useEffect(() => {
    if (!isOpen) setConfirmText("");
  }, [isOpen]);

  const canConfirm =
    !(action === "trash" && isHighRisk) || confirmText === "DELETE";

  if (!isOpen) return null;

  // ... rest of your file stays exactly the same

  const ACTION_CONFIG = {
    archive: {
      title: "Archive emails",
      description: `${count} emails from "${scope}" will be removed from your inbox but kept in All Mail. You can find them anytime by searching Gmail.`,
      confirmLabel: "Archive All",
      confirmColor: "#d97706",
    },
    trash: {
      title: isHighRisk ? "⚠️ Are you sure?" : "Move to Trash",
      description: isHighRisk
        ? `"${scope}" emails may contain important information like statements, invoices or documents. Moving ${count} emails to Trash means they'll be permanently deleted after 30 days. Are you absolutely sure?`
        : `${count} emails from "${scope}" will be moved to Trash. Gmail keeps them there for 30 days before permanent deletion.`,
      confirmLabel: isHighRisk ? "Yes, Trash Anyway" : "Move to Trash",
      confirmColor: "#dc2626",
    },
    label: {
      title: "Apply Label",
      description: null,
      confirmLabel: "Apply Label",
      confirmColor: "#0d9488",
    },
  };

  const config = ACTION_CONFIG[action];
  if (!config) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "28px",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
          boxSizing: "border-box",
        }}
      >
        {/* Title */}
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#111827",
            marginBottom: "12px",
            marginTop: "0",
          }}
        >
          {config.title}
        </h3>

        {/* Description */}
        {action === "label" ? (
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: "1.6",
                margin: "0 0 12px 0",
              }}
            >
              {count} emails will be labelled in Gmail. Nothing will be moved or
              deleted.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                backgroundColor: "#f0fdfa",
                border: "1px solid #99f6e4",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "14px" }}>🏷️</span>
              <code
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0f766e",
                  fontFamily: "monospace",
                }}
              >
                Sweepyr/{category}
              </code>
            </div>
          </div>
        ) : (
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: "1.6",
              marginBottom: "20px",
              marginTop: "0",
            }}
          >
            {config.description}
          </p>
        )}

        {/* Info box */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              margin: "0",
            }}
          >
            ℹ️ We only act on emails you have reviewed. You can always undo in
            Gmail.
          </p>
        </div>

        {/* DELETE confirmation input — only for high risk trash */}
        {action === "trash" && isHighRisk && (
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "13px",
                color: "#374151",
                marginBottom: "8px",
                fontWeight: "500",
                margin: "0 0 8px 0",
              }}
            >
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Type DELETE here"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
                letterSpacing: "2px",
                color: "#111827",
                backgroundColor: "#ffffff",
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          {/* For high risk trash — swap visual weight */}
          {action === "trash" && isHighRisk ? (
            <>
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: canConfirm ? "#dc2626" : "#9ca3af",
                  backgroundColor: "#ffffff",
                  border: `1px solid ${canConfirm ? "#dc2626" : "#d1d5db"}`,
                  borderRadius: "8px",
                  cursor: canConfirm ? "pointer" : "not-allowed",
                }}
              >
                {config.confirmLabel}
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#ffffff",
                  backgroundColor: "#16a34a",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel — Keep Emails
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  backgroundColor: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#ffffff",
                  backgroundColor: canConfirm ? config.confirmColor : "#9ca3af",
                  border: "none",
                  borderRadius: "8px",
                  cursor: canConfirm ? "pointer" : "not-allowed",
                }}
              >
                {config.confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
