import { withSentryConfig } from '@sentry/nextjs';
import { createRequire } from 'module';

// createRequire rather than a JSON import-attribute, for reliable ESM JSON
// loading across Node versions in this plain .mjs config file.
const require = createRequire(import.meta.url);
const { version: packageVersion } = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Re-expose Vercel's auto-injected git metadata under NEXT_PUBLIC_ so it's
  // readable client-side too, not just in server code. This is the version
  // indicator - tied to the exact commit, updates automatically on every
  // build, never needs a manual bump. Falls back to 'local' values when
  // running outside Vercel (e.g. `npm run dev`).
  // NEXT_PUBLIC_APP_VERSION_NUMBER is the one human-readable piece - bump it
  // in package.json's "version" field whenever you want to mark a release,
  // separate from the auto-updating git-based identifiers above.
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
      : 'local-dev',
    NEXT_PUBLIC_GIT_BRANCH: process.env.VERCEL_GIT_COMMIT_REF || 'local',
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV || 'development',
    NEXT_PUBLIC_APP_VERSION_NUMBER: packageVersion,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "project-idk",

  project: "sweepyr",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
