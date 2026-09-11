// Standard error responses for API routes
export function authExpiredResponse() {
  return Response.json(
    {
      error: 'GMAIL_AUTH_EXPIRED',
      message: 'Your Gmail connection has expired. Please reconnect.',
      action: 'RECONNECT',
    },
    { status: 401 }
  )
}

export function unauthorizedResponse() {
  return Response.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}

// Wraps an API route handler with standard auth error catching
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('API Error:', error.message)

      if (error.code === 'GMAIL_AUTH_EXPIRED') {
        return authExpiredResponse()
      }

      return Response.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
    }
  }
}