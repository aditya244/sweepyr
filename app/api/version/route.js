// Public, unauthenticated - the whole point is to be curl-able without
// signing in, to quickly confirm what commit/branch/environment is
// actually live. No secrets exposed - just git metadata.
export async function GET() {
  return Response.json({
    version: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
      : 'local-dev',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
    environment: process.env.VERCEL_ENV || 'development',
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    releaseVersion: process.env.NEXT_PUBLIC_APP_VERSION_NUMBER || null,
  });
}
