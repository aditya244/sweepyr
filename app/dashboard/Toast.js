"use client";

import { useEffect } from "react";

// Small, non-blocking confirmation bar — distinct from ConfirmModal, which
// blocks and requires a decision. This is for "here's what just happened,"
// not "are you sure." Auto-dismisses; also dismissible by hand.
//
// Currently plain (no countdown/undo). TODO.md's "Undo last action" item
// plans to extend this same component with a countdown + undo button rather
// than building a second toast component from scratch.
export default function Toast({ message, onDismiss, durationMs = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#0d9488",
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: "500",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "min(90vw, 480px)",
      }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          color: "#ffffff",
          opacity: 0.8,
          cursor: "pointer",
          fontSize: "14px",
          padding: "0",
          lineHeight: "1",
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
