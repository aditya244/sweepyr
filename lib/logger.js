import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV === 'development'

export function logError(error, context = {}) {
  // Always log to console
  console.error('[Error]', error.message, context)

  // In production, send to Sentry
  if (!isDev) {
    Sentry.withScope(scope => {
      // Add context as extra data in Sentry
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(error)
    })
  }
}

export function logWarning(message, context = {}) {
  console.warn('[Warning]', message, context)

  if (!isDev) {
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: context,
    })
  }
}

export function logInfo(message, context = {}) {
  // Info only logs to console — not sent to Sentry
  // Use for non-error events you want to track locally
  console.log('[Info]', message, context)
}

// Sets user context in Sentry so you can see which user hit an error
export function setUserContext(user) {
  if (!isDev && user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    })
  }
}

// Clears user context on sign out
export function clearUserContext() {
  if (!isDev) {
    Sentry.setUser(null)
  }
}