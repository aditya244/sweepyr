import * as Sentry from "@sentry/nextjs";

export async function register() {
  console.log(
    `[Sweepyr] ${process.env.VERCEL_ENV || "development"} · ${process.env.VERCEL_GIT_COMMIT_REF || "local"} · ${process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : "local-dev"} · v${process.env.NEXT_PUBLIC_APP_VERSION_NUMBER}`
  );

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
