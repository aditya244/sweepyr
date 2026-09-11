"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            border: "2px solid #e5e7eb",
            borderTopColor: "#111",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          height: '72px',
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src="/app-icon-512.png" style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }} alt="Sweepyr" />
          <span style={{ fontWeight: '700', fontSize: '20px', color: '#111827' }}>Sweepyr</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a
            href="/pricing"
            style={{
              fontSize: "14px",
              color: "#6b7280",
              textDecoration: "none",
            }}
          >
            Pricing
          </a>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            style={{
              padding: "10px 20px",
              backgroundColor: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "80px 32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#f0fdfa",
            color: "#0f766e",
            fontSize: "12px",
            fontWeight: "500",
            padding: "6px 14px",
            borderRadius: "999px",
            marginBottom: "28px",
          }}
        >
          <span>🔒</span>
          <span>Privacy-first — we never read your emails</span>
        </div>

        <h1
          style={{
            fontSize: "52px",
            fontWeight: "800",
            color: "#111827",
            lineHeight: "1.15",
            marginBottom: "20px",
            marginTop: "0",
          }}
        >
          Clean your inbox.
          <br />
          <span style={{ color: "#0d9488" }}>Without the anxiety.</span>
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#6b7280",
            lineHeight: "1.7",
            marginBottom: "40px",
            marginTop: "0",
          }}
        >
          Sweepyr scans your Gmail, sorts thousands of emails into smart
          categories, and helps you archive or delete clutter — in minutes, not
          hours.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#111827",
            color: "#fff",
            padding: "16px 32px",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google — it's free
        </button>

        <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
          No credit card required · Free for 200 emails/month
        </p>
      </section>

      {/* How it works */}
      <section style={{ backgroundColor: "#f9fafb", padding: "80px 32px" }}>
        <div
          style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}
        >
          <h2
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "8px",
              marginTop: "0",
            }}
          >
            How it works
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "56px", marginTop: "0" }}>
            Three steps to a cleaner inbox
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "32px",
            }}
          >
            {[
              {
                step: "01",
                icon: "🔗",
                title: "Connect Gmail",
                desc: "Sign in with Google. We request only the minimum permissions needed — no reading your email content, ever.",
              },
              {
                step: "02",
                icon: "✨",
                title: "We sort your inbox",
                desc: "Our AI scans sender info and subject lines to sort your emails into smart categories like Finance, Receipts, Newsletters and more.",
              },
              {
                step: "03",
                icon: "🧹",
                title: "You clean with confidence",
                desc: "Review each category, see what's safe to delete, archive or label — then take action in one click.",
              },
            ].map((item) => (
              <div key={item.step} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "#e0e7ff",
                    borderRadius: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    margin: "0 auto 16px",
                  }}
                >
                  {item.icon}
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#5eead4",
                    letterSpacing: "0.08em",
                    marginBottom: "8px",
                    marginTop: "0",
                  }}
                >
                  STEP {item.step}
                </p>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#111827",
                    marginBottom: "8px",
                    marginTop: "0",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Highlights */}
      <section
        style={{ maxWidth: "720px", margin: "0 auto", padding: "80px 32px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#f0fdf4",
              color: "#166534",
              fontSize: "12px",
              fontWeight: "600",
              padding: "6px 14px",
              borderRadius: "999px",
              marginBottom: "16px",
            }}
          >
            <span>🤖</span>
            <span>AI-Powered Inbox Intelligence</span>
          </div>
          <h2
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#111827",
              margin: "0 0 12px 0",
            }}
          >
            Smart sorting, zero effort
          </h2>
          <p
            style={{
              fontSize: "16px",
              color: "#6b7280",
              margin: "0",
              lineHeight: "1.7",
            }}
          >
            Our AI reads between the lines — without reading your emails.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "20px",
          }}
        >
          {[
            {
              icon: "🧠",
              title: "Three-layer classification",
              desc: "Emails are first sorted by smart rules, then domain reputation, and finally by AI — so only the truly ambiguous ones hit the AI layer. Fast, accurate and cost-efficient.",
            },
            {
              icon: "🎯",
              title: "Indian inbox first",
              desc: "Built specifically for Indian inboxes. Recognises HDFC, Swiggy, Naukri, IRCTC, Paytm, PhonePe and hundreds more out of the box.",
            },
            {
              icon: "✋",
              title: "You stay in control",
              desc: "AI suggests, you decide. Every action — archive, delete, label — requires your confirmation. Nothing happens to your inbox without your approval.",
            },
            {
              icon: "📊",
              title: "13 smart categories",
              desc: "From Finance and OTP to Receipts, Travel and Newsletters — your inbox gets sorted into categories that actually make sense for how you use email.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #f3f4f6",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "12px" }}>
                {item.icon}
              </div>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 8px 0",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  margin: "0",
                  lineHeight: "1.6",
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Trust */}
      <section style={{ backgroundColor: "#f9fafb", padding: "80px 32px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#fff7ed",
                color: "#c2410c",
                fontSize: "12px",
                fontWeight: "600",
                padding: "6px 14px",
                borderRadius: "999px",
                marginBottom: "16px",
              }}
            >
              <span>🔐</span>
              <span>Security & Trust</span>
            </div>
            <h2
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#111827",
                margin: "0 0 12px 0",
              }}
            >
              Built to earn your trust
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                margin: "0",
                lineHeight: "1.7",
              }}
            >
              We know handing over Gmail access is a big deal. Here's exactly
              what we do and don't do.
            </p>
          </div>

          {/* Do / Don't table */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "48px",
            }}
          >
            <div
              style={{
                backgroundColor: "#f0fdf4",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #bbf7d0",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#166534",
                  margin: "0 0 16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✅</span> What we DO
              </h3>
              {[
                "Read sender email addresses",
                "Read subject lines",
                "Read email headers",
                "Apply labels you approve",
                "Archive emails you confirm",
                "Move emails to Trash on request",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    fontSize: "13px",
                    color: "#166534",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: "1px" }}>→</span>
                  {item}
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: "#fff1f2",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #fecdd3",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#be123c",
                  margin: "0 0 16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>🚫</span> What we DON'T do
              </h3>
              {[
                "Read email body content",
                "Store your email content",
                "Share your data with anyone",
                "Take any action without approval",
                "Permanently delete anything",
                "Access emails outside Gmail",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    fontSize: "13px",
                    color: "#be123c",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: "1px" }}>✕</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Security badges row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            {[
              {
                icon: "🔒",
                title: "Metadata only",
                desc: "Enforced at the Gmail API level — format=metadata means the body is physically never sent to us",
              },
              {
                icon: "👁️",
                title: "Full transparency",
                desc: "Your dashboard shows exactly what was accessed and when. No hidden activity.",
              },
              {
                icon: "🗑️",
                title: "Trash, not delete",
                desc: "We never permanently delete. Emails go to Trash first — 30 days to recover anything.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid #e5e7eb",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>
                  {item.icon}
                </div>
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: "0 0 6px 0",
                  }}
                >
                  {item.title}
                </h4>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    margin: "0",
                    lineHeight: "1.5",
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section
        style={{ maxWidth: "720px", margin: "0 auto", padding: "80px 32px" }}
      >
        <div
          style={{
            backgroundColor: "#f0fdfa",
            borderRadius: "20px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <span
            style={{ fontSize: "40px", display: "block", marginBottom: "16px" }}
          >
            🔒
          </span>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "12px",
              marginTop: "0",
            }}
          >
            Your privacy is non-negotiable
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#4b5563",
              lineHeight: "1.7",
              maxWidth: "480px",
              margin: "0 auto 32px",
            }}
          >
            Sweepyr only reads sender addresses, subject lines and email
            headers. We never access the content of your emails. This is
            enforced at the API level — not just a policy promise.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "32px",
              flexWrap: "wrap",
            }}
          >
            {[
              "Sender & subject only",
              "No email body access",
              "You approve every action",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                  color: "#374151",
                  fontWeight: "500",
                }}
              >
                <span style={{ color: "#0d9488" }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {/* Pricing CTA */}
      <section
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "80px 32px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#111827",
            margin: "0 0 12px 0",
          }}
        >
          Simple, honest pricing
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "#6b7280",
            margin: "0 0 16px 0",
            lineHeight: "1.7",
          }}
        >
          Start free with 100 emails/month. Upgrade when you need more. No
          hidden fees, cancel anytime.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          {[
            { name: "Free", price: "₹0", desc: "forever" },
            { name: "Pro", price: "₹99", desc: "per month" },
            { name: "Annual", price: "₹500", desc: "per year" },
            { name: "Deep Clean", price: "₹299", desc: "one-time" },
          ].map((plan, i) => (
            <div
              key={plan.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: i === 2 ? "#111827" : "#f9fafb",
                border: i === 2 ? "none" : "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px 20px",
                minWidth: "110px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: i === 2 ? "#5eead4" : "#6b7280",
                  marginBottom: "4px",
                }}
              >
                {plan.name}
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: "800",
                  color: i === 2 ? "#fff" : "#111827",
                }}
              >
                {plan.price}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: i === 2 ? "#9ca3af" : "#9ca3af",
                }}
              >
                {plan.desc}
              </span>
            </div>
          ))}
        </div>

        <a
          href="/pricing"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "14px 32px",
            backgroundColor: "#0d9488",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: "600",
            textDecoration: "none",
            marginTop: "8px",
          }}
        >
          See full pricing →
        </a>
        <p
          style={{
            fontSize: "12px",
            color: "#9ca3af",
            marginTop: "12px",
            marginBottom: "0",
          }}
        >
          No credit card required to get started
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #f3f4f6",
          padding: "32px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>📬</span>
          <span style={{ fontWeight: "700", color: "#111827" }}>Sweepyr</span>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <a
            href="/privacy"
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              textDecoration: "none",
            }}
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              textDecoration: "none",
            }}
          >
            Terms of Service
          </a>
          <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0" }}>
            Built with privacy in mind · Made in India 🇮🇳
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
