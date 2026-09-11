"use client";

import { useState, useRef, useEffect} from "react";
import CategorySummary from "./CategorySummary";
import CategoryDetail from "./CategoryDetail";
import StatsBar from "./StatsBar";
import MonitoringFeed from "./MonitoringFeed";
import ReconnectBanner from "./ReconnectBanner";
import OnboardingWelcome from "./OnboardingWelcome";

export default function DashboardClient({ userName }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  // All state lives here so it survives view switches
  const [emailCount, setEmailCount] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false)
  const [userStatusLoaded, setUserStatusLoaded] = useState(false)
  const [tier, setTier] = useState('free')
  const [usage, setUsage] = useState(null)
  const startScanRef = useRef(null);

  async function checkUserStatus() {
    try {
      const res = await fetch('/api/user/status')
      const data = await res.json()
      if (data.isNewUser) setIsNewUser(true)
      if (data.tier) setTier(data.tier)
      if (data.usage) setUsage(data.usage)
    } catch (err) {
      console.error('Error checking user status:', err)
    } finally {
      setUserStatusLoaded(true)
    }
  }

  useEffect(() => {
    checkUserStatus()
  }, [])

  function refreshStats() {
    setStatsRefreshKey((prev) => prev + 1);
  }

  function handleActionComplete(category) {
    if (!classifyResult?.summary) return;
    setClassifyResult((prev) => {
      const newSummary = { ...prev.summary };
      delete newSummary[category];
      return { ...prev, summary: newSummary };
    });
  }

  async function refreshEmailCount() {
    try {
      const res = await fetch('/api/gmail/count')
      const data = await res.json()
      if (data.count) setEmailCount(data.count)
    } catch (err) {
      console.error('Error refreshing count:', err)
    }
  }

  function handleApiResponse(data) {
    if (data?.error === "GMAIL_AUTH_EXPIRED") {
      setShowReconnectBanner(true);
      return false;
    }
    return true;
  }

  function handleCategoryOverride(fromCategory, toCategory) {
    if (!classifyResult?.summary) return;

    setClassifyResult((prev) => {
      const newSummary = { ...prev.summary };

      // Decrement the source category
      if (newSummary[fromCategory] > 1) {
        newSummary[fromCategory] = newSummary[fromCategory] - 1;
      } else {
        delete newSummary[fromCategory]; // remove if count hits 0
      }

      // Increment the destination category
      newSummary[toCategory] = (newSummary[toCategory] || 0) + 1;

      return { ...prev, summary: newSummary };
    });
  }

  if (selectedCategory) {
    return (
      <>
        <CategoryDetail
          category={selectedCategory}
          onBack={() => setSelectedCategory(null)}
          onCategoryOverride={handleCategoryOverride}
          onActionComplete={handleActionComplete}
          onStatsRefresh={refreshStats}
          onCountRefresh={refreshEmailCount}
        />
        {showReconnectBanner && (
          <ReconnectBanner onDismiss={() => setShowReconnectBanner(false)} />
        )}
      </>
    );
  }
  return (
  <>
    {showReconnectBanner && (
      <ReconnectBanner onDismiss={() => setShowReconnectBanner(false)} />
    )}

    <StatsBar refreshKey={statsRefreshKey} emailCount={emailCount} />
    <MonitoringFeed onStatsRefresh={refreshStats} />

    {/* Show onboarding for new users instead of the normal mailbox card */}
    {userStatusLoaded && isNewUser && !scanDone ? (
      <OnboardingWelcome
        userName={userName}
        onStartScan={() => {
          // Hide onboarding and trigger scan
          setIsNewUser(false)
          // Small delay to let CategorySummary mount first
          setTimeout(() => {
            if (startScanRef.current) {
              startScanRef.current()
            }
          }, 100)
          // The CategorySummary scan button will handle the rest
        }}
      />
    ) : (
      <div style={{ marginTop: '24px' }}>
        <CategorySummary
          onCategorySelect={setSelectedCategory}
          emailCount={emailCount}
          setEmailCount={setEmailCount}
          scanning={scanning}
          setScanning={setScanning}
          scanDone={scanDone}
          setScanDone={setScanDone}
          classifying={classifying}
          setClassifying={setClassifying}
          classifyResult={classifyResult}
          setClassifyResult={setClassifyResult}
          setProgress={setProgress}
          error={error}
          setError={setError}
          onAuthError={() => setShowReconnectBanner(true)}
          startScanRef={startScanRef}
          tier={tier}
          usage={usage}
          onUsageRefresh={checkUserStatus}
        />
      </div>
    )}
  </>
)
}
