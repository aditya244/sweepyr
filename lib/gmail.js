import { google } from 'googleapis'

// Detects if a Gmail API error is an authentication/token error
export function isAuthError(error) {
  const message = error?.message?.toLowerCase() || ''
  const code = error?.code || error?.status

  return (
    message.includes('invalid_grant') ||
    message.includes('token has been expired') ||
    message.includes('token has been revoked') ||
    message.includes('invalid_rapt') ||
    code === 401
  )
}

// Wraps any Gmail API call with consistent error handling
// Usage: await gmailCall(() => gmail.users.messages.list({...}))
export async function gmailCall(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isAuthError(error)) {
      // Throw a specific error type that API routes can catch
      const authError = new Error('GMAIL_AUTH_EXPIRED')
      authError.code = 'GMAIL_AUTH_EXPIRED'
      throw authError
    }
    throw error
  }
}

// This function takes a user's refresh token and returns
// an authenticated Gmail API client ready to make calls.
// We'll call this at the start of every Gmail operation.

export function getGmailClient(refreshToken) {
  // Create an OAuth2 client using your app's credentials
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  // Give it the user's refresh token.
  // The client will automatically use this to get a fresh
  // access token whenever it needs to make an API call.
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  // Return an initialised Gmail API client
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

// Fetches total number of emails in the user's mailbox
export async function getEmailCount(refreshToken) {
  const gmail = getGmailClient(refreshToken)

  const response = await gmailCall(() =>
    gmail.users.getProfile({
      userId: 'me',
    })
  )

  return response.data.messagesTotal
}

// Fetches a list of message IDs from the inbox
// maxResults: how many to fetch (max 500 per call)
// pageToken: for pagination — fetch the next page of results
export async function getMessageIds(refreshToken, maxResults = 100, pageToken = null) {
  const gmail = getGmailClient(refreshToken)

  const params = {
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'], // only fetch inbox emails, not sent/drafts/etc
  }

  // pageToken lets us fetch the next batch of emails
  // Gmail API returns results in pages, not all at once
  if (pageToken) {
    params.pageToken = pageToken
  }

  const response = await gmailCall(() =>
    gmail.users.messages.list(params)
  )

  return {
    messageIds: response.data.messages || [],
    nextPageToken: response.data.nextPageToken || null,
  }
}

// Fetches metadata for a single email by its ID.
// format: 'metadata' is the critical parameter here —
// it tells Gmail to return ONLY headers, never the body.
// This is our privacy guarantee at the API level.
export async function getEmailMetadata(refreshToken, messageId) {
  const gmail = getGmailClient(refreshToken)

  const response = await gmailCall(() =>
    gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: [
        'From', 'Subject', 'Date', 'List-Unsubscribe',
        'Precedence', 'X-Mailer', 'Reply-To', 'Content-Type', 'To',
      ],
    })
  )

  const headers = response.data.payload.headers
  const headerMap = {}
  headers.forEach(header => {
    headerMap[header.name.toLowerCase()] = header.value
  })

  // Detect attachments by checking payload parts
  // This is safe — we're only reading filenames, not content
  const hasAttachment = detectAttachment(response.data.payload)

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds || [],
    snippet: response.data.snippet,
    from: headerMap['from'] || '',
    subject: headerMap['subject'] || '',
    date: headerMap['date'] || '',
    headers: headerMap,
    hasAttachment, // new field
  }
}

// Recursively checks payload parts for attachments
// Only looks at filenames and mimeTypes — never content
function detectAttachment(payload) {
  if (!payload) return false

  // Check if content-type suggests attachment
  const contentType = payload.mimeType || ''
  if (contentType === 'multipart/mixed') return true

  // Check parts recursively
  if (payload.parts && payload.parts.length > 0) {
    return payload.parts.some(part => {
      // Has a filename = it's an attachment
      if (part.filename && part.filename.length > 0) return true
      // Common attachment mime types
      if (part.mimeType === 'application/pdf') return true
      if (part.mimeType === 'application/octet-stream') return true
      if (part.mimeType?.startsWith('application/vnd')) return true
      // Recurse into nested parts
      if (part.parts) return detectAttachment(part)
      return false
    })
  }

  return false
}

// Fetches metadata for multiple emails in parallel.
// We use Promise.all to fire all requests simultaneously
// rather than waiting for each one to finish before starting the next.
export async function getBatchEmailMetadata(refreshToken, messageIds) {
  const promises = messageIds.map(({ id }) =>
    getEmailMetadata(refreshToken, id)
  )

  // If any individual email fetch fails, we don't want the whole
  // batch to fail — allSettled returns results for each promise
  // regardless of whether it succeeded or failed.
  const results = await Promise.allSettled(promises)

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
}