# Mailclean Codebase - Detailed Analysis & Deep Dive

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File-by-File Analysis](#file-by-file-analysis)
3. [Next.js Specific Concepts](#nextjs-specific-concepts)
4. [Database & MongoDB](#database--mongodb)
5. [API Integrations](#api-integrations)
6. [Authentication Flow](#authentication-flow)
7. [Email Classification Pipeline](#email-classification-pipeline)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React Components + useSession) - Client Side     │
├─────────────────────────────────────────────────────────────┤
│  page.js (Landing) → DashboardClient → CategorySummary/    │
│                                        CategoryDetail        │
├─────────────────────────────────────────────────────────────┤
│  API ROUTES (Server Side - Next.js Route Handlers)         │
├─────────────────────────────────────────────────────────────┤
│ Auth Flow:  authOptions → [...nextauth]/route.js           │
│ Gmail:      scan → process (SSE) → classify                │
│ Emails:     fetch (GET) → actions (POST) → group-action    │
├─────────────────────────────────────────────────────────────┤
│  LIBRARIES (Server-side utilities)                          │
├─────────────────────────────────────────────────────────────┤
│ Gmail API Client → getGmailClient() → Gmail Metadata       │
│ Classifier Pipeline → Rules → Domain → Gemini AI          │
│ Gmail Actions → Archive/Trash/Label                        │
├─────────────────────────────────────────────────────────────┤
│  DATABASE (MongoDB + Mongoose)                             │
├─────────────────────────────────────────────────────────────┤
│ User Collection → Email Collection → ActionHistory         │
└─────────────────────────────────────────────────────────────┘
```

---

# FILE-BY-FILE ANALYSIS

## 1. [app/page.js](app/page.js) - Landing Page

### What it does
- Entry point for unauthenticated users
- Shows marketing landing page with "How It Works" section
- Provides sign-in CTAs that redirect to Google OAuth

### Key Methods/Patterns
```javascript
useSession() // Hook from NextAuth - gets current session state
useRouter() // Next.js navigation hook - client-side routing
signIn('google', { callbackUrl: '/dashboard' }) // NextAuth function
```

### Next.js Specific Patterns

**1. `'use client'` directive**
```javascript
'use client'
```
- This component is a **Client Component** - runs entirely in browser
- Allows use of React hooks like `useState`, `useEffect`, `useSession`
- Critical for interactive features (button clicks, session checking)

**Why**: Although it's the landing page (often server-rendered for SEO), the auth check (`useSession()`) must be interactive to redirect users, so it needs to be a client component.

**2. Dynamic routing with `useRouter`**
```javascript
const router = useRouter()
useEffect(() => {
  if (status === 'authenticated') {
    router.push('/dashboard')
  }
}, [status, router])
```
- This is **Next.js-specific client-side navigation**
- Difference from regular React: `router.push()` re-renders without full page reload
- Why: Seamless UX - authenticated users skip landing page instantly

### How the Styling Works
- All inline styles (no CSS imports)
- This is intentional for a landing page - keeps bundle size small
- Uses flexbox and inline CSS-in-JS

---

## 2. [lib/authOptions.js](lib/authOptions.js) - NextAuth Configuration

### What it does
- Central authentication configuration for the entire app
- Handles Google sign-in flow
- Creates/updates user in MongoDB on sign-in
- Manages JWT tokens and session data

### Key Concept: NextAuth Callbacks

NextAuth fires callbacks at specific points in the auth flow:

```javascript
callbacks: {
  async signIn({ user, account }) { ... },
  async session({ session, token }) { ... },
  async jwt({ token }) { ... }
}
```

**Why this architecture?**

In traditional React apps, you'd manage auth yourself. NextAuth provides hooks at key moments:

| Callback | When Fired | Purpose |
|----------|-----------|---------|
| `signIn` | After Google returns user info | Save user to DB, get refresh token |
| `jwt` | When JWT is created/refreshed | Fetch user data from DB |
| `session` | When `useSession()` is called | Return user data to frontend |

### Deep Dive: The `signIn` Callback

```javascript
async signIn({ user, account }) {
  if (account.provider !== "google") return false;
  
  try {
    await connectDB();
    
    const existingUser = await User.findOne({ googleId: user.id });
    
    if (existingUser) {
      if (account.refresh_token) {
        existingUser.refreshToken = account.refresh_token;
        await existingUser.save();
      }
    } else {
      await User.create({
        googleId: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        refreshToken: account.refresh_token,
      });
    }
    return true;
  } catch (error) {
    return false;
  }
}
```

**What's happening:**
1. Checks if provider is Google (could support other providers later)
2. Connects to MongoDB
3. Looks for existing user by `googleId` (Google's unique ID)
4. If exists: Updates `refreshToken` if Google returned a new one
5. If new: Creates user document with initial data
6. Returns `true` to allow sign-in, `false` to deny

**Why save `refreshToken`?**

```
Google OAuth Flow:
1. User clicks "Sign in with Google"
2. Google opens modal, user enters credentials
3. Google redirects back with:
   - access_token (short-lived, ~1 hour)
   - refresh_token (long-lived, can last years)
4. We save the refresh_token in MongoDB
5. Later, when user isn't online, we can use this token to:
   - Call Gmail API on their behalf
   - Fetch their emails without them being present
```

### OAuth Scopes Explained

```javascript
scope: [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" "),
```

| Scope | What It Allows |
|-------|----------------|
| `openid` | Basic OAuth (required) |
| `email` | Read user's email address |
| `profile` | Read user's name, picture |
| `gmail.readonly` | Read emails (metadata only) |
| `gmail.labels` | Create/modify Gmail labels |
| `gmail.modify` | Archive, trash, label emails |

### Deep Dive: `session` and `jwt` Callbacks

```javascript
async session({ session, token }) {
  if (token) {
    session.user.id = token.sub;  // Add Google ID to session
    session.user.tier = token.tier; // Add tier for feature gating
  }
  return session;
}

async jwt({ token }) {
  if (token.sub) {
    await connectDB();
    const dbUser = await User.findOne({ googleId: token.sub });
    if (dbUser) {
      token.tier = dbUser.tier; // Fetch tier from DB
    }
  }
  return token;
}
```

**The flow:**
1. When user calls `useSession()` on frontend
2. NextAuth looks at JWT token
3. Calls `jwt()` callback: Fetches user tier from DB, stores in token
4. Calls `session()` callback: Copies data from token to session object
5. Session object returned to frontend

**Why two callbacks instead of one?**

- `jwt()` runs on **every token refresh** (frequent)
- `session()` runs when session is **actively used**
- JWT callback can query DB to get fresh data (like tier updates)
- Session callback shapes the data for frontend consumption

---

## 3. [app/dashboard/page.js](app/dashboard/page.js) - Dashboard Server Component

### What it does
- Server-side protected route
- Checks authentication before rendering
- Renders dashboard UI

### Key Concept: Server Components (Next.js 13+)

```javascript
// NO 'use client' here - this is a Server Component by default
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/')
  }
  return (...)
}
```

**This is fundamentally different from React:**

| Traditional React | Next.js Server Components |
|------------------|--------------------------|
| All code runs in browser | Code runs on server |
| Call `useSession()` hook | Call `await getServerSession()` |
| Session data fetched client-side | Session fetched server-side |
| Redirect via `useRouter()` | Redirect via `redirect()` |

**Why this architecture?**

```
Benefits:
1. SECURITY: Auth check happens server-side - can't be bypassed by client-side code
2. PERFORMANCE: No JavaScript sent to browser for this page
3. FASTER: Session data doesn't need network round-trip
```

### How it works

1. **Build time**: Next.js bundles this page
2. **Request time**: 
   - Server-side route handler intercepts request
   - `getServerSession()` checks cookie/JWT
   - If no session → `redirect('/')` (server-side)
   - If authenticated → Renders JSX

3. **If user somehow loads page without session**:
   - `redirect()` sends HTTP 307 to browser
   - Browser automatically requests `/`

**Why not just check auth on client?**

If you checked auth only on client:
```javascript
// DON'T DO THIS on server components
const session = useSession() // Can't use in server component
if (!session) return null // Would show nothing briefly - bad UX
```

Server-side check ensures:
- No flash of unauthorized content
- Unforgeable auth (server validates, not client)
- SEO-friendly (page is fully rendered on server)

---

## 4. [app/dashboard/DashboardClient.js](app/dashboard/DashboardClient.js) - Client State Management

### What it does
- Central client-side state management for dashboard
- Manages UI flow: CategorySummary → CategoryDetail → back
- Holds all process states (scanning, classifying, results)

### Next.js Pattern: Server Component + Client Component Boundary

**dashboard/page.js** (Server Component):
```javascript
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  
  return (
    <DashboardClient /> {/* This is a Client Component */}
  )
}
```

**DashboardClient.js** (Client Component):
```javascript
'use client'

export default function DashboardClient() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  // ... client-side state
}
```

**Why this pattern?**

```
Without this pattern:
- Entire dashboard would be client-side
- Lots of JavaScript in browser
- Auth checking would be less secure

With this pattern:
- Server verifies auth (secure)
- Only interactive parts are client code
- Better performance
```

### State Structure

```javascript
// UI Navigation State
const [selectedCategory, setSelectedCategory] = useState(null);

// Process States
const [scanning, setScanning] = useState(false);           // During scan
const [scanDone, setScanDone] = useState(false);           // Scan complete
const [classifying, setClassifying] = useState(false);     // During classification
const [classifyResult, setClassifyResult] = useState(null); // Results

// Display States
const [emailCount, setEmailCount] = useState(null);        // Total inbox emails
const [progress, setProgress] = useState(null);            // Current progress
const [error, setError] = useState(null);                  // Error messages

// Refresh trigger
const [statsRefreshKey, setStatsRefreshKey] = useState(0); // Causes re-fetch
```

### Critical Helper Functions

**`handleActionComplete(category)` - Update state after bulk action**
```javascript
function handleActionComplete(category) {
  if (!classifyResult?.summary) return;
  
  setClassifyResult((prev) => {
    const newSummary = { ...prev.summary };
    delete newSummary[category]; // Remove category from summary
    return { ...prev, summary: newSummary };
  });
}
```

**Why this matters:**
- After user archives all "Promotions", that category disappears from dashboard
- Uses immutable state pattern (spread operator)
- Only updates displayed summary, actual DB records update via API

**`handleCategoryOverride(fromCategory, toCategory)` - Update counts when user moves email**
```javascript
function handleCategoryOverride(fromCategory, toCategory) {
  setClassifyResult((prev) => {
    const newSummary = { ...prev.summary };
    
    // Decrement source
    if (newSummary[fromCategory] > 1) {
      newSummary[fromCategory]--;
    } else {
      delete newSummary[fromCategory];
    }
    
    // Increment destination
    newSummary[toCategory] = (newSummary[toCategory] || 0) + 1;
    
    return { ...prev, summary: newSummary };
  });
}
```

**Why immutable updates?**
- React's `useState` uses `Object.is()` for re-render detection
- Mutating directly: `state.summary[cat]--` won't trigger re-render
- Creating new object forces React to detect change
- This is fundamental React pattern, not Next.js specific

---

## 5. [app/dashboard/CategorySummary.js](app/dashboard/CategorySummary.js) - Main Dashboard UI

### What it does
- Shows summary of all email categories with counts
- Provides UI for starting scan/classification
- Streams progress via server-sent events (SSE)

### Key API Calls

**Get current email count from Gmail:**
```javascript
const res = await fetch("/api/gmail/count");
const data = await res.json();
setEmailCount(data.count);
```

**Load existing classification summary:**
```javascript
const summaryRes = await fetch("/api/emails/summary");
const summaryData = await summaryRes.json();
```

**Start combined scan + classify (with streaming):**
```javascript
const url = `/api/gmail/process?batchSize=${batchSize}`;
const eventSource = new EventSource(url);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setProgress({ stage: data.stage, percent: data.percent });
};
```

### Important Next.js Concept: Server-Sent Events (SSE)

**What is SSE?**

Traditional HTTP:
```
Client: GET /api/data
Server: Returns 200 with data
Connection closes
```

Server-Sent Events:
```
Client: Opens GET /api/stream
Server: Keeps connection open
Server: Sends "data: {...}\n\n" whenever it wants
Server: Connection stays open until done
Client: Receives multiple updates without polling
```

**Why use SSE instead of polling?**

```javascript
// POLLING (bad for long operations)
let progress = 0;
while (progress < 100) {
  const res = await fetch('/api/progress');
  progress = res.json().percent;
  setProgress(progress);
  await sleep(1000); // Wait before checking again
}
// Makes 100+ requests, wastes server resources

// SSE (efficient)
const eventSource = new EventSource('/api/stream');
eventSource.onmessage = (event) => {
  setProgress(JSON.parse(event.data).percent);
};
// Server sends data when available, client just listens
```

**Why SSE works with Next.js:**

Next.js API routes return `Response` objects. SSE requires:
1. Keep connection open
2. Stream data over time
3. Use `Content-Type: text/event-stream`

```javascript
// /api/gmail/process/route.js can return a ReadableStream:
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

### Batch Size Configuration (Tier-based)

```javascript
const TIER_BATCH_OPTIONS = {
  free:      [100],
  pro:       [100, 200, 500],
  annual:    [100, 200, 500, 1000],
  deepclean: [100, 500, 1000, 2500, 5000],
}
```

**How this works:**
- Free users can only process 100 emails per scan
- Pro users get options for 100, 200, or 500
- Why? Rate limiting, cost control, feature differentiation

---

## 6. [app/api/gmail/count/route.js](app/api/gmail/count/route.js) - Get Gmail Mailbox Count

### What it does
- API endpoint that returns total email count in user's inbox
- Server-side, requires authentication

### Next.js API Route Syntax

```javascript
export async function GET(request) {
  // HTTP method: GET
  // request: Object with url, body, headers
  // Returns: Response object
}

export async function POST(request) { ... }
export async function PATCH(request) { ... }
```

**How this differs from traditional Node/Express:**

```javascript
// Express
app.get('/api/gmail/count', (req, res) => {
  res.json({ count: 1000 });
});

// Next.js
export async function GET(request) {
  return Response.json({ count: 1000 });
}
```

Next.js wraps everything in Response objects (Web Standard API).

### The Actual Implementation

```javascript
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) {
      return Response.json({ error: 'No refresh token found' }, { status: 400 })
    }

    const count = await getEmailCount(user.refreshToken)
    return Response.json({ count })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

**Authentication check:**
- `getServerSession(authOptions)` validates NextAuth session
- Returns null if not authenticated
- Returns user info if authenticated

**Then calls:**
- `User.findOne({ googleId: session.user.id })` - Get from MongoDB
- `getEmailCount(refreshToken)` - Call lib/gmail.js

---

## 7. [lib/gmail.js](lib/gmail.js) - Gmail API Client

### What it does
- Wraps Google's Gmail API
- Handles OAuth2 client creation
- Provides methods to fetch emails without reading content

### Deep Dive: OAuth2 Credentials Management

```javascript
export function getGmailClient(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}
```

**What's happening:**

1. **Create OAuth2 client** with app credentials (from .env):
   - `GOOGLE_CLIENT_ID`: Your app's ID (public)
   - `GOOGLE_CLIENT_SECRET`: Your app's secret (private)
   - `redirectUrl`: Where Google redirects after login

2. **Set credentials** with user's refresh token:
   - This tells the client: "When you need to call Gmail API, use this token"
   - The client automatically handles token refresh if expired

3. **Return Gmail API client**:
   - Ready to make API calls on behalf of the user

**Why this architecture?**

```
Timeline:
1. User logs in with Google
2. We get a refresh_token (valid for ~years)
3. We store it in MongoDB
4. Later, when user isn't online:
   - We call getGmailClient(storedRefreshToken)
   - We call gmail.users.messages.list()
   - Auth is automatic - Gmail API verifies token
```

### Key Methods

#### `getEmailCount(refreshToken)`
```javascript
export async function getEmailCount(refreshToken) {
  const gmail = getGmailClient(refreshToken)
  
  const response = await gmail.users.getProfile({
    userId: 'me',
  })
  
  return response.data.messagesTotal
}
```

**Why `'me'`?**
- Gmail API convention for "current authenticated user"
- No need to look up user ID, API knows from the OAuth token

#### `getMessageIds(refreshToken, maxResults = 100, pageToken = null)`
```javascript
const response = await gmail.users.messages.list({
  userId: 'me',
  maxResults,
  labelIds: ['INBOX'], // Only inbox, not sent/drafts/trash
})

return {
  messageIds: response.data.messages || [],
  nextPageToken: response.data.nextPageToken || null,
}
```

**Why only INBOX?**
- User probably only wants to clean inbox
- Sent/Drafts are usually less cluttered
- API supports pagination - can fetch more batches

**Pagination flow:**
```
Request 1: Get IDs 1-100, get nextPageToken
Request 2: Use nextPageToken to get IDs 101-200, get new nextPageToken
Request 3: No nextPageToken = reached end
```

#### `getEmailMetadata(refreshToken, messageId)` - Privacy-Focused Design

```javascript
export async function getEmailMetadata(refreshToken, messageId) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata', // ← CRITICAL: Only headers, never body
    metadataHeaders: [
      'From', 'Subject', 'Date',
      'List-Unsubscribe', 'Precedence',
      'X-Mailer', 'Reply-To', 'Content-Type', 'To',
    ],
  })

  // Process headers into object
  const headers = response.data.payload.headers
  const headerMap = {}
  headers.forEach(header => {
    headerMap[header.name.toLowerCase()] = header.value
  })

  const hasAttachment = detectAttachment(response.data.payload)

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
    from: headerMap['from'] || '',
    subject: headerMap['subject'] || '',
    date: headerMap['date'] || '',
    headers: headerMap,
    hasAttachment,
    // NO body field - we never read the actual email content
  }
}
```

**Privacy Guarantee:**

The `format: 'metadata'` parameter is crucial:

```
Without it: response.data.payload.body.data = entire email content (base64)
With it: We only get headers - no body accessed

This means:
✓ We CANNOT read email content
✓ User's privacy guaranteed at API level
✓ No sensitive data risk
```

**Headers returned:**
- `From`: Sender email (used for classification)
- `Subject`: Subject line (used for classification)
- `List-Unsubscribe`: Newsletter unsubscribe link
- `Precedence`: Gmail uses this to detect auto-responses
- `X-Mailer`: Email client used (helps detect email type)

#### `detectAttachment(payload)` - Recursive MIME Type Checking

```javascript
function detectAttachment(payload) {
  if (!payload) return false

  // Email might be multipart/mixed = likely has attachments
  if (payload.mimeType === 'multipart/mixed') return true

  // Check parts recursively
  if (payload.parts && payload.parts.length > 0) {
    return payload.parts.some(part => {
      // This part is definitely an attachment
      if (part.filename && part.filename.length > 0) return true
      
      // These MIME types indicate binary attachments
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
```

**Email MIME Structure:**

```
Email with attachment:
├── multipart/mixed
│   ├── Part 1: multipart/alternative (the body)
│   │   ├── text/plain
│   │   └── text/html
│   └── Part 2: application/pdf (ATTACHMENT)
│       └── filename: "report.pdf"
```

This recursion navigates that tree to find attachments.

#### `getBatchEmailMetadata(refreshToken, messageIds)` - Parallel Requests

```javascript
export async function getBatchEmailMetadata(refreshToken, messageIds) {
  const promises = messageIds.map(({ id }) =>
    getEmailMetadata(refreshToken, id)
  )

  const results = await Promise.allSettled(promises)

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
}
```

**Why `Promise.allSettled` instead of `Promise.all`?**

```javascript
// Promise.all - if any fails, whole thing fails
const results = await Promise.all([fetch1, fetch2, fetch3])
// If fetch2 fails: Error thrown, fetch3 never runs

// Promise.allSettled - all run independently
const results = await Promise.allSettled([fetch1, fetch2, fetch3])
// If fetch2 fails: fetch3 still runs
// Returns: { status: 'fulfilled', value: ... } or { status: 'rejected', reason: ... }
```

**Why this matters:**

If you're fetching 500 emails and one API call fails:
- `Promise.all`: Entire batch fails, user sees error
- `Promise.allSettled`: Gets 499 emails, only 1 failed - acceptable

---

## 8. [app/api/gmail/scan/route.js](app/api/gmail/scan/route.js) - Scan Gmail (Phase 1)

### What it does
- Fetches first 500 emails from user's inbox
- Fetches metadata for each
- Saves to MongoDB
- Doesn't classify yet - just stores the data

### Flow

```javascript
// Step 1: Get message IDs
const { messageIds } = await getMessageIds(user.refreshToken, 500)

// Step 2: Fetch metadata for all of them in parallel
const emails = await getBatchEmailMetadata(user.refreshToken, messageIds)

// Step 3: Save to MongoDB
for (const email of emails) {
  await Email.findOneAndUpdate(
    { userId: user._id, messageId: email.messageId },
    { ...email, userId: user._id },
    { upsert: true, new: true }
  )
}
```

### Important MongoDB Pattern: upsert

```javascript
Email.findOneAndUpdate(
  { userId: user._id, messageId: email.messageId }, // query
  { ...email, userId: user._id },                    // update
  { upsert: true, new: true }                        // options
)
```

**What does `upsert` do?**

```
If document matching query exists:
  → Update it with new data

If document doesn't exist:
  → Insert it (like create)

This ensures:
✓ Running scan twice doesn't duplicate emails
✓ Running scan again updates metadata if changed
✓ Single operation instead of check-then-insert
```

**Why is this important?**

Without upsert, you'd need:
```javascript
const exists = await Email.findOne({ userId, messageId })
if (exists) {
  await Email.updateOne({ userId, messageId }, { ...data })
} else {
  await Email.create({ userId, messageId, ...data })
}
```

That's 2 DB queries. Upsert does it in 1.

---

## 9. [app/api/gmail/process/route.js](app/api/gmail/process/route.js) - Combined Scan + Classify (Phase 1+2+3)

### What it does
- The **most complex** endpoint
- Combines scanning + classi fying in one streaming operation
- Uses Server-Sent Events to stream progress to frontend
- Handles tier-based rate limiting

### Important Next.js Pattern: ReadableStream

```javascript
const encoder = new TextEncoder()
let controller

const stream = new ReadableStream({
  start(c) {
    controller = c
  },
  cancel() {
    console.log('SSE connection closed by client')
  },
})

function send(data) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

// Run processing in background
;(async () => {
  // ... do work ...
  send({ stage: 'done', ... })
  controller.close()
})()

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
})
```

**How SSE format works:**

```
Server sends:
data: {"stage":"scanning","percent":10}\n\n
data: {"stage":"scanning","percent":20}\n\n
data: {"stage":"classifying","percent":50}\n\n
data: {"stage":"done","percent":100}\n\n

Client JavaScript:
const es = new EventSource('/api/gmail/process')
es.onmessage = (event) => {
  console.log(JSON.parse(event.data)) // Logs each object
}
```

### Tier-based Rate Limiting

```javascript
const TIER_LIMITS = {
  free: 100,
  pro: 500,
  annual: 1000,
  deepclean: 5000,
}

const userTier = user.tier || 'free'
const maxAllowed = TIER_LIMITS[userTier] || 100
const batchSize = Math.min(requestedSize, maxAllowed)
```

**Why?**

```
Free tier: expensive (Gemini AI costs $)
Pro tier: moderate cost
Annual: unlimited

So we:
1. Let user request any batch size
2. Cap it at their tier limit
3. Prevents free users from processing 5000 emails
```

### Stage 1: Fetching Message IDs

```javascript
send({ stage: 'scanning', message: 'Fetching email list...', progress: 0 })

const { messageIds } = await getMessageIds(user.refreshToken, batchSize)
const total = messageIds.length

send({ stage: 'scanning', message: `Found ${total} emails...`, progress: 0 })
```

### Stage 2: Fetching Metadata in Batches of 50

```javascript
for (let i = 0; i < messageIds.length; i += 50) {
  const chunk = messageIds.slice(i, i + 50)
  
  const results = await Promise.allSettled(
    chunk.map(({ id }) => getEmailMetadata(user.refreshToken, id))
  )
  
  // Save successful results
  for (const email of successful) {
    await Email.findOneAndUpdate(
      { userId: user._id, messageId: email.messageId },
      { ...email, userId: user._id },
      { upsert: true, new: true }
    )
  }
  
  // Update progress (scanning = 0-50%)
  send({
    stage: 'scanning',
    percent: Math.round((scanned / total) * 50),
  })
}
```

**Why in batches of 50?**

```
Gmail API limits:
- Per second: ~100 requests
- Per day: 1 billion quota units

50 requests in parallel:
- Still within rate limits
- Yet fast enough (parallel processing)
- Balance between speed and reliability
```

### Stage 3: Classification

```javascript
const unprocessed = await Email.find({
  userId: user._id,
  isProcessed: false,
}).limit(batchSize)

for (let i = 0; i < unprocessed.length; i += 5) {
  const batch = unprocessed.slice(i, i + 5)
  
  const results = await Promise.allSettled(
    batch.map(email => classifyEmail(email))
  )
  
  // Save results
  for (const result of results) {
    await Email.findByIdAndUpdate(email._id, {
      category,
      confidence,
      classificationSource,
      isProcessed: true,
    })
  }
  
  // Update progress (classifying = 50-100%)
  send({
    stage: 'classifying',
    percent: 50 + Math.round((classified / total) * 50),
  })
  
  // delay to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 300))
}
```

**Why only 5 in parallel for classification?**

```
Metadata fetch: 50 in parallel
  → Metadata is fast (Gmail API knows this)
  → Can handle parallelism

Classification: 5 in parallel
  → Calls Gemini AI
  → Gemini has rate limits (queries per minute)
  → 5 is conservative to avoid hitting limits
  → 300ms delay between batches gives more breathing room
```

---

## 10. [app/api/gmail/classify/route.js](app/api/gmail/classify/route.js) - Classify Unprocessed Emails

### What it does
- Simpler classification endpoint (no streaming)
- Classifies up to 100 unprocessed emails at once
- Used as alternative to `/process`

### The Flow

```javascript
const emails = await Email.find({
  userId: user._id,
  isProcessed: false,
}).limit(100)

const results = await classifyEmails(emails) // Run pipeline

// Save results and build summary
for (const result of results) {
  await Email.findByIdAndUpdate(result.emailId, {
    category: result.category,
    confidence: result.confidence,
    classificationSource: result.classificationSource,
    isProcessed: true,
  })
}

// Build summary object: { Finance: 15, Spam: 8, ... }
const summary = results.reduce((acc, result) => {
  acc[result.category] = (acc[result.category] || 0) + 1
  return acc
}, {})

return Response.json({
  classified: results.length,
  summary,
  layerStats,
})
```

---

## 11. [lib/classifier/index.js](lib/classifier/index.js) - Classification Pipeline

### What it does
- Orchestrates 3-layer classification
- Rules → Domain → AI (each layer has confidence threshold)

### Deep Dive: Why 3-Layer Classification?

```
Goal: Classify emails accurately AND affordably

Problem: Gemini AI is expensive (~$0.075 per 1M tokens)
         Calling for every email would be costly

Solution: 3-layer confidence-based system

Layer 1: RULES (free, instant)
  - Check subjects (OTP, transaction, etc)
  - High confidence patterns
  - NO external API costs

Layer 2: DOMAIN (free, instant)
  - Check sender domain (HDFC Bank = Finance)
  - Hardcoded knowledge base of Indian banks/services
  - NO external API costs

Layer 3: AI (paid, requires API call)
  - Only used if layers 1-2 aren't confident
  - By this point, maybe 60-70% already classified
  - Reduces AI calls by 60-70%

Result: 80-90% cost savings
```

### Implementation

```javascript
const CONFIDENCE_THRESHOLD = 0.85

export async function classifyEmail(email) {
  // Layer 1: Rules
  const rulesResult = classifyByRules(email)
  if (rulesResult && rulesResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...rulesResult, classificationSource: 'rules' }
  }

  // Layer 2: Domain
  const domainResult = classifyByDomain(email)
  if (domainResult && domainResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...domainResult, classificationSource: 'domain' }
  }

  // Layer 3: AI (only if needed)
  const aiResult = await classifyByAI(email)
  return { ...aiResult, classificationSource: 'ai' }
}
```

**Why 0.85 threshold?**

```
0.85 = 85% confidence

This means:
- Only pass to next layer if less than 85% sure
- Balances accuracy vs cost
- If all 3 layers return < 0.85, use AI anyway
```

### Processing Multiple Emails with Rate Limiting

```javascript
export async function classifyEmails(emails) {
  const results = []

  for (const email of emails) {
    const result = await classifyEmail(email)
    results.push(result)

    // Only delay if AI was used
    if (result.classificationSource === "ai") {
      const delay = process.env.NODE_ENV === "production" ? 100 : 100
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return results
}
```

**Why delay?**

Gemini API Rate Limits:
- ~60 requests per minute (in free tier at time of writing)
- 100ms delay = ~10 requests per second = within limits
- In production, could be tuned finer

---

## 12. [lib/classifier/rules.js](lib/classifier/rules.js) - Pattern-Based Classification

### What it does
- Regex-based email classification
- Checks subject lines and headers for patterns
- VERY fast, NO API calls

### Strategy: Progressive Checks

```javascript
function isOTPEmail(subject) {
  const patterns = [
    /\botp\b/i,
    /one.time.password/i,
    /verification code/i,
    /your code is/i,
    /\d{4,8} is your/i, // "234567 is your"
    /use this code/i,
    /login code/i,
    /security code/i,
    /otp for/i,
  ]
  return patterns.some((p) => p.test(subject))
}
```

**Real examples:**

```
✓ "Your OTP is 123456" (matches /\botp is/i)
✓ "234567 is your verification code" (matches /\d{4,8} is your/)
✓ "Enter this code: 789" (matches /enter this code/i)
✗ "One time offer on shoes" (doesn't match - "one time" != "one.time")
```

### More Complex: Transaction Detection

```javascript
function isTransactionEmail(subject) {
  const patterns = [
    /debited/i,
    /credited/i,
    /transaction/i,
    /payment (confirmed|received|failed|successful)/i,
    /amount of (rs\.?|inr|₹)/i,
    /\bUPI\b/,
    /NEFT|RTGS|IMPS/i,
    /a\/c.*debited/i, // "a/c 1234... debited"
    /sent ₹/i,
    /received ₹/i,
    /cashback of ₹/i,
    /reward points/i,
    /auto debit is active/i,
  ]
  return patterns.some((p) => p.test(subject))
}
```

### The classifyByRules Function

```javascript
export function classifyByRules(email) {
  const { subject, from, headers } = email

  // Check specific patterns in order of priority
  if (isOTPEmail(subject)) {
    return { category: 'OTP & Security', confidence: 0.95 }
  }

  if (isTransactionEmail(subject)) {
    return { category: 'Transactions', confidence: 0.92 }
  }

  if (isReceiptEmail(subject)) {
    return { category: 'Receipts', confidence: 0.90 }
  }

  if (isTravelEmail(subject)) {
    return { category: 'Travel', confidence: 0.89 }
  }

  // Check for newsletter-specific headers
  if (headers?.['list-unsubscribe'] && 
      (isPromotional(subject) || isNewsletter(subject))) {
    return { category: 'Newsletter', confidence: 0.85 }
  }

  // No match
  return null
}
```

**Performance:**

```
Rules layer:
- 100 emails: ~50ms (pure regex)
- 1000 emails: ~500ms
- vs Gemini AI layer:
  - 1 email: ~1000-2000ms
  - High latency due to network + API

Running 100 emails through rules:
~50ms: can process all directly
vs calling AI (would need batching, delays, retries)
```

---

## 13. [lib/classifier/domain.js](lib/classifier/domain.js) - Domain Reputation

### What it does
- Looks up sender domain in hardcoded knowledge base
- Maps domains to categories (HDFC Bank = Finance, Swiggy = Receipts)
- Extremely fast, NO external API

### The Knowledge Base

```javascript
const KNOWN_DOMAINS = {
  // Indian Banks
  "hdfcbank.com": { category: "Finance", confidence: 0.97 },
  "icicibank.com": { category: "Finance", confidence: 0.97 },
  "sbi.co.in": { category: "Finance", confidence: 0.97 },
  
  // Payments
  "paytm.com": { category: "Transactions", confidence: 0.97 },
  "phonepe.com": { category: "Transactions", confidence: 0.97 },
  "gpay.app": { category: "Transactions", confidence: 0.97 },
  
  // E-commerce
  "amazon.in": { category: "Receipts", confidence: 0.95 },
  "flipkart.com": { category: "Receipts", confidence: 0.95 },
  
  // Travel
  "irctc.co.in": { category: "Travel", confidence: 0.98 },
  "makemytrip.com": { category: "Travel", confidence: 0.97 },
  
  // Food Delivery
  "swiggy.in": { category: "Receipts", confidence: 0.97 },
  "zomato.com": { category: "Receipts", confidence: 0.97 },
}
```

**Why this works for India:**

```
This is a domain lookup database optimized for Indian users:
✓ Indian banks (HDFC, ICICI, SBI, Axis, Kotak)
✓ Indian payment systems (Paytm, PhonePe, UPI services)
✓ Indian e-commerce (Flipkart, Amazon.in, Myntra)
✓ Indian travel (IRCTC for trains, MakeMyTrip)
✓ Indian food (Swiggy, Zomato)

This is why the app description says "Built specifically for Indian inboxes"
```

### Implementation

```javascript
export function classifyByDomain(email) {
  const { from } = email
  const domain = extractDomain(from)

  if (!domain) return null

  // Check if it's a personal email provider
  if (PERSONAL_EMAIL_PROVIDERS.includes(domain)) {
    return null // Can't determine, pass to AI
  }

  // Extract base domain to handle subdomains
  const baseDomain = extractBaseDomain(domain)

  // Lookup in knowledge base
  const known = KNOWN_DOMAINS[baseDomain] || KNOWN_DOMAINS[domain]
  if (known) {
    return known
  }

  // Check for suspicious subdomain patterns
  const isSuspiciousSubdomain = SUSPICIOUS_PATTERNS.some(
    pattern => pattern.test(domain)
  )
  if (isSuspiciousSubdomain) {
    return { category: 'Promotions', confidence: 0.78 }
  }

  // Check for noreply addresses
  if (from?.includes('noreply')) {
    return { category: 'Notifications', confidence: 0.80 }
  }

  return null
}
```

**Domain extraction logic:**

```javascript
function extractBaseDomain(domain) {
  // "em123.newsletter.amazon.com" → "amazon.com"
  // "customer-service.icicibank.com" → "icicibank.com"
  
  const parts = domain.split('.')
  if (parts.length > 2) {
    return parts.slice(-2).join('.') // Last 2 parts
  }
  return domain
}
```

**Examples:**

```
em123.newsletter.amazon.com
→ domain = "em123.newsletter.amazon.com"
→ baseDomain = "amazon.com"
→ Looks up KNOWN_DOMAINS["amazon.com"]
→ Returns { category: "Receipts", confidence: 0.95 }

mail.hdfcbank.com
→ domain = "mail.hdfcbank.com"
→ baseDomain = "hdfcbank.com"
→ Looks up KNOWN_DOMAINS["hdfcbank.com"]
→ Returns { category: "Finance", confidence: 0.97 }
```

---

## 14. [lib/classifier/ai.js](lib/classifier/ai.js) - Gemini AI Classification

### What it does
- Calls Google's Gemini API for final classification
- Only used if rules and domain layers aren't confident enough
- Handles rate limiting with exponential backoff

### Deep Dive: Gemini API Integration

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function classifyByAI(email, retryCount = 0) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-lite' 
  })

  const prompt = `
You are an email classifier...
[full prompt]
`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  
  return parsed
}
```

### Prompt Engineering

**Why the specific prompt format?**

```javascript
const prompt = `
You are an email classifier. Classify this email into exactly one category.

Sender: ${email.from}
Subject: ${email.subject || '(no subject)'}
Has unsubscribe option: ${email.headers?.['list-unsubscribe'] ? 'yes' : 'no'}
Precedence header: ${email.headers?.['precedence'] || 'none'}

Categories to choose from:
- Spam: unsolicited, phishing, scam emails
- Promotions: sales, discounts, offers from businesses
- Newsletter: blogs, digests, editorial content
- Social: social media notifications
- OTP & Security: one-time passwords, login alerts, security emails
- Transactions: payment confirmations, bank debits, UPI transactions
- Receipts: order confirmations, invoices, purchase receipts
- Finance: bank statements, tax documents, insurance, investments
- Work: professional emails from colleagues, clients or recruiters
- Personal: emails from friends or family
- Notifications: app alerts, system notifications
- Travel: flight, hotel, train bookings and confirmations
- Uncertain: cannot determine category confidently
- Jobs & Careers: job alerts, recruiter emails, LinkedIn job posts, career opportunities

Respond with ONLY a JSON object, no other text:
{
  "category": "one of the categories above",
  "confidence": 0.0 to 1.0,
  "reason": "one short sentence explaining why"
}
`
```

**Why this structure?**

1. **Role clarification**: "You are an email classifier" sets context
2. **Explicit category list**: AI knows exactly which categories exist
3. **Description for each**: Clarifies ambiguous cases
4. **Email data provided**:
   - `from`: Sender (helps determine business vs personal)
   - `subject`: Main content indicator
   - `list-unsubscribe`: Newsletter indicator
   - `precedence`: Automated response indicator

5. **JSON format request**: Forces structured output
6. **Confidence score**: AI rates its own certainty

### Rate Limiting & Retry Logic

```javascript
try {
  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const cleaned = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  if (!VALID_CATEGORIES.includes(parsed.category)) {
    return {
      category: 'Uncertain',
      confidence: 0.5,
      reason: 'AI returned unrecognised category',
    }
  }

  return parsed

} catch (error) {
  // Handle rate limit with exponential backoff
  if (error.message?.includes('429') && retryCount < 3) {
    const waitTime = (retryCount + 1) * 5000 // 5s, 10s, 15s
    console.log(`Rate limited — waiting ${waitTime / 1000}s before retry ${retryCount + 1}/3`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return classifyByAI(email, retryCount + 1) // Recursive retry
  }

  // If retries exhausted or different error, default to Uncertain
  return {
    category: 'Uncertain',
    confidence: 0,
    reason: 'AI classification failed',
  }
}
```

**Exponential Backoff Explained:**

```
Attempt 1 hits rate limit (429)
  → Wait 5 seconds
  → Retry (attempt 2)

Attempt 2 hits rate limit
  → Wait 10 seconds
  → Retry (attempt 3)

Attempt 3 hits rate limit
  → Wait 15 seconds
  → Retry (attempt 4)

Attempt 4 hits rate limit
  → Give up, return Uncertain

Why exponential?
- Gives API time to recover
- Doesn't hammer server with immediate retries
- Standard pattern in distributed systems
```

### Why Gemini Flash Lite?

```javascript
model: 'gemini-2.5-flash-lite'
```

**Model choices:**

| Model | Cost | Speed | Quality |
|-------|------|-------|---------|
| GPT-4 | Very expensive | Slow | Best |
| Claude 3 Opus | Expensive | Moderate | Excellent |
| Gemini 2.5 Flash | Cheap | Fast | Good |
| Gemini 2.5 Flash Lite | **Cheapest** | **Fastest** | Good |

For email classification:
- Don't need GPT-4 quality
- Cost matters (millions of emails)
- Flash Lite is sweet spot: cheap + fast + good enough

---

## 15. [app/dashboard/CategoryDetail.js](app/dashboard/CategoryDetail.js) - Single Category View

### What it does
- Shows all emails in a category
- Lets user override categories for individual emails
- Lets user perform bulk actions (archive, trash, label) on groups

### Key State Management

```javascript
const [emails, setEmails] = useState([])
const [loading, setLoading] = useState(true)
const [page, setPage] = useState(1)
const [hasMore, setHasMore] = useState(false)
const [total, setTotal] = useState(0)
const [overriding, setOverriding] = useState(null)  // Which email being moved
const [actioning, setActioning] = useState(false)   // Bulk action in progress
const [isGrouped, setIsGrouped] = useState(false)   // View mode
const [expandedGroups, setExpandedGroups] = useState({}) // Which groups open
```

### Fetching Emails with Pagination

```javascript
async function fetchEmails(pageNum) {
  try {
    setLoading(true)
    const res = await fetch(
      `/api/emails?category=${encodeURIComponent(category)}&page=${pageNum}`
    )
    const data = await res.json()

    if (pageNum === 1) {
      setEmails(data.emails) // Replace
    } else {
      setEmails((prev) => [...prev, ...data.emails]) // Append
    }

    setTotal(data.total)
    setHasMore(data.hasMore)
    setPage(pageNum)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
```

**Pagination strategy:**

```
Page 1: Loads emails 1-20
Page 2: Appends emails 21-40 (loads more)
Page 3: Appends emails 41-60 (loads more)

vs traditional pagination (replace on each page):
- Better UX: Can see previous emails
- Infinite scroll: "Load more" button at bottom
```

### Individual Email Override

```javascript
async function overrideCategory(messageId, newCategory) {
  try {
    setOverriding(messageId)
    
    const res = await fetch(`/api/emails/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ category: newCategory }),
    })

    // Remove from current view
    setEmails((prev) => prev.filter((e) => e.messageId !== messageId))
    setTotal((prev) => prev - 1)

    // Tell parent to update summary counts
    onCategoryOverride(category, newCategory)

  } finally {
    setOverriding(null)
  }
}
```

**Why call `onCategoryOverride`?**

```
Parent (DashboardClient) has:
  classifyResult = { summary: { Finance: 15, Spam: 10, ... } }

When user moves email: Finance 15 → Spam 11
Child (CategoryDetail) calls:
  onCategoryOverride('Finance', 'Spam')

Parent updates state:
  summary { Finance: 14, Spam: 11, ... }

Result: Dashboard updates immediately
```

### Grouping Emails by Domain

```javascript
function groupEmailsByDomain(emails) {
  const groups = {}
  emails.forEach((email) => {
    const domain = extractSenderDomain(email.from)
    if (!groups[domain]) {
      groups[domain] = {
        domain,
        displayName: getDomainDisplayName(domain),
        emails: [],
      }
    }
    groups[domain].emails.push(email)
  })

  // Sort by email count descending
  return Object.values(groups).sort(
    (a, b) => b.emails.length - a.emails.length
  )
}
```

**Example:**

```
Input: 50 emails in "Receipts" category
  - 20 from amazon.in
  - 15 from flipkart.com
  - 10 from swiggy.in
  - 5 from zomato.com

After grouping:
  [
    { domain: "amazon.in", displayName: "Amazon", emails: [20 emails] },
    { domain: "flipkart.com", displayName: "Flipkart", emails: [15 emails] },
    { domain: "swiggy.in", displayName: "Swiggy", emails: [10 emails] },
    { domain: "zomato.com", displayName: "Zomato", emails: [5 emails] },
  ]

UI shows:
  [ Amazon (20) ▼ ] - shows emails when expanded
  [ Flipkart (15) ▼ ]
  [ Swiggy (10) ▼ ]
  [ Zomato (5) ▼ ]
```

### Bulk Actions

```javascript
async function executeAction(action) {
  try {
    setActioning(true)

    const res = await fetch("/api/emails/actions", {
      method: "POST",
      body: JSON.stringify({ action, category }), // 'archive', 'trash', or 'label'
    })

    const data = await res.json()

    // Clear the email list - they've been actioned
    setEmails([])
    setTotal(0)
    
    // Notify parent to update summary
    onActionComplete(category)
    onStatsRefresh()

  } finally {
    setActioning(false)
  }
}
```

**What happens next in Gmail:**

```
API receives: { action: 'archive', category: 'Promotions' }

1. Finds all emails in Promotions category
2. Gets their messageIds
3. Calls Gmail API:
   - archive: Removes INBOX label (stays in All Mail)
   - trash: Moves to Trash folder (recoverable 30 days)
   - label: Adds "CleanMail/Promotions" label

Result: User's Gmail reflects the action immediately
```

---

## 16. [app/api/emails/route.js](app/api/emails/route.js) - Get Emails by Category (with Pagination)

### What it does
- Fetches emails for a specific category
- Supports pagination
- Returns metadata only (no body)

### Implementation

```javascript
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20

  if (!category) {
    return Response.json({ error: 'Category is required' }, { status: 400 })
  }

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })

    // Fetch paginated emails + total count in parallel
    const [emails, total] = await Promise.all([
      Email.find({ userId: user._id, category })
        .sort({ date: -1 })
        .skip((page - 1) * 20)
        .limit(limit)
        .select('messageId from subject date confidence classificationSource hasAttachment labelIds headers'),
      Email.countDocuments({ userId: user._id, category }),
    ])

    return Response.json({
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: (page - 1) * 20 + emails.length < total,
    })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### MongoDB Query Patterns

**`.select('field1 field2')`** - Get only specific fields

```javascript
.select('messageId from subject date confidence classificationSource')
```

Without `.select()`: Returns entire document (1000+ bytes)
With `.select()`: Returns only needed fields (~500 bytes)

Result: Faster network, less bandwidth used

**`.sort({ date: -1 })`** - Newest first

```
-1 = descending (newest)
1 = ascending (oldest)
```

**`.skip((page - 1) * 20).limit(limit)`** - Pagination

```
Page 1: skip(0).limit(20) → emails 0-19
Page 2: skip(20).limit(20) → emails 20-39
Page 3: skip(40).limit(20) → emails 40-59
```

**`Promise.all([...queries])`** - Parallel execution

```javascript
// DO THIS:
const [emails, total] = await Promise.all([
  Email.find(...),
  Email.countDocuments(...),
])
// 2 queries run in parallel = ~1 network round trip

// DON'T DO THIS:
const emails = await Email.find(...)
const total = await Email.countDocuments(...)
// 2 queries run sequentially = ~2 network round trips
```

---

## 17. [app/api/emails/[messageId]/route.js](app/api/emails/[messageId]/route.js) - Override Individual Email Category

### What it does
- User manually moves an email to different category
- Updates email document in MongoDB

### Implementation

```javascript
export async function PATCH(request, { params }) {
  const { messageId } = params
  const { category } = await request.json()

  // Validate
  if (!ALL_CATEGORIES.includes(category)) {
    return Response.json({ error: 'Invalid category' }, { status: 400 })
  }

  try {
    const user = await User.findOne({ googleId: session.user.id })

    await Email.findOneAndUpdate(
      { userId: user._id, messageId },
      { category, classificationSource: 'user' },
      { new: true }
    )

    return Response.json({ success: true })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

**Key: Set `classificationSource: 'user'`**

```
This tracks HOW the email was classified:
- 'rules': Auto-sorted by regex patterns
- 'domain': Auto-sorted by domain lookup
- 'ai': Auto-sorted by Gemini AI
- 'user': Manually moved by user

Useful for:
- Analytics: See which emails users override
- Training: Maybe rules/AI are wrong for certain domains?
- Feedback: User feedback improves system
```

---

## 18. [app/api/emails/actions/route.js](app/api/emails/actions/route.js) - Bulk Category Action

### What it does
- Execute bulk action on entire category in Gmail
- Archive/Trash/Label all emails in category
- Update MongoDB to mark as actioned

### Deep Dive: How Bulk Actions Work

```javascript
export async function POST(request) {
  const { action, category } = await request.json()

  // Validate
  if (!['archive', 'trash', 'label'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Get all email messageIds for this category
  const emails = await Email.find({
    userId: user._id,
    category,
  }).select('messageId')

  const messageIds = emails.map(e => e.messageId)

  // Execute action on Gmail side
  let result = 0
  if (action === 'archive') {
    result = await archiveEmails(user.refreshToken, messageIds)
  } else if (action === 'trash') {
    result = await trashEmails(user.refreshToken, messageIds)
  } else if (action === 'label') {
    const labelName = `CleanMail/${category}`
    const labelId = await getOrCreateLabel(user.refreshToken, labelName)
    result = await applyLabel(user.refreshToken, messageIds, labelId)
  }

  // Save action history
  await ActionHistory.create({
    userId: user._id,
    action,
    category,
    emailCount: result,
    labelName: action === 'label' ? `CleanMail/${category}` : undefined,
    messageIds,
  })

  // Mark emails as processed in our DB
  await Email.updateMany(
    { userId: user._id, category },
    {
      $set: {
        actionTaken: action,
        category: null,
        isProcessed: false,
      }
    }
  )

  return Response.json({
    success: true,
    action,
    category,
    affected: result,
  })
}
```

### Important MongoDB Pattern: `updateMany`

```javascript
// Update ALL matching documents at once
await Email.updateMany(
  { userId: user._id, category },  // Filter
  { $set: { actionTaken: action, category: null } } // Update
)
```

**vs individual updates:**

```javascript
// DON'T DO THIS:
for (const email of emails) {
  await Email.findByIdAndUpdate(email._id, { actionTaken: action })
}
// If 1000 emails: 1000 DB calls

// DO THIS:
await Email.updateMany(
  { userId: user._id, category },
  { $set: { actionTaken: action } }
)
// 1 DB call for all 1000 emails
```

### Why set `category: null` after action?

```
After user archives all "Promotions":
- Want them removed from CategoryDetail view
- Setting category: null removes them from filters
- They still exist in DB (for history/audit)
- But won't appear in dashboards anymore

When CategoryDetail calls:
  Email.find({ userId, category: 'Promotions' })
  
These actioned emails won't match (category: null)
So they disappear from UI
```

---

## 19. [lib/gmailActions.js](lib/gmailActions.js) - Gmail API Actions

### What it does
- Wraps Gmail API for label/archive/trash operations
- Handles batch operations efficiently
- Rate limit aware

### Key Methods

#### `getOrCreateLabel(refreshToken, labelName)`

```javascript
export async function getOrCreateLabel(refreshToken, labelName) {
  const gmail = getGmailClient(refreshToken)

  // Check if label exists
  const existing = await gmail.users.labels.list({ userId: 'me' })
  const found = existing.data.labels.find(l => l.name === labelName)
  if (found) return found.id

  // Create if not found
  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  })

  return created.data.id
}
```

**Why check before creating?**

```
If you call getOrCreateLabel multiple times:
- First call: Label doesn't exist → Create "CleanMail/Finance"
- Second call (same label): Label exists → Return ID
- Result: Single label used for all Finance emails

Without the check:
- Each call would try to create
- Gmail API rejects duplicates
- Errors in console
```

#### `archiveEmails(refreshToken, messageIds)` - Safe Removal

```javascript
export async function archiveEmails(refreshToken, messageIds) {
  const gmail = getGmailClient(refreshToken)

  const chunks = chunkArray(messageIds, 1000)
  let archived = 0

  for (const chunk of chunks) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: chunk,
        removeLabelIds: ['INBOX'],
      },
    })
    archived += chunk.length
  }

  return archived
}
```

**What "archive" means:**

```
Gmail label system:
- Email has: [INBOX, ARCHIVE_AFTER_ACTION, custom_label]
- Archive = remove INBOX label
- Email now has: [ARCHIVE_AFTER_ACTION, custom_label]
- Still in: All Mail, Search results, Custom label
- NOT in: Inbox (disappeared from view)

Why archive instead of delete?
- Reversible: Can still search/find
- Safe: 30-day trash before permanent delete
- Standard Gmail practice
```

#### `trashEmails(refreshToken, messageIds)` - Recoverable Delete

```javascript
export async function trashEmails(refreshToken, messageIds) {
  const gmail = getGmailClient(refreshToken)

  const chunks = chunkArray(messageIds, 50)
  let trashed = 0

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(id => gmail.users.messages.trash({ userId: 'me', id }))
    )
    trashed += results.filter(r => r.status === 'fulfilled').length

    // Small delay to respect rate limits
    if (chunks.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return trashed
}
```

**Why smaller chunks (50) for trash vs archive (1000)?**

```
Gmail API Note: Trash doesn't support batch operation
- Can't call batchModify for trash
- Must call trash() individually for each message

Chunking strategy:
- Fetch 50 at a time
- Fire them in parallel
- Wait 500ms before next batch
- Avoids hammering API with 1000 individual requests

If 10,000 emails to trash:
- 50 at a time = 200 batches
- 500ms delay = 100 seconds total
- Slower than ideal, but safe within rate limits
```

#### `applyLabel(refreshToken, messageIds, labelId)`

```javascript
export async function applyLabel(refreshToken, messageIds, labelId) {
  const gmail = getGmailClient(refreshToken)

  const chunks = chunkArray(messageIds, 1000)
  let labeled = 0

  for (const chunk of chunks) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: chunk,
        addLabelIds: [labelId],
      },
    })
    labeled += chunk.length
  }

  return labeled
}
```

**Use both archive AND label:**

```
Common workflow:
1. User chooses "Label: CleanMail/Finance"
2. API:
   - Creates label if needed
   - Applies label to all Finance category emails
   - (Optional: could also archive = remove from inbox)

Result in Gmail:
- Emails stay in Inbox, plus have "CleanMail/Finance" label
- Can filter by: label:CleanMail/Finance
- Can star, archive later, etc.
```

---

## 20. [models/User.js](models/User.js) & [models/Email.js](models/Email.js) - Data Models

### User Model

```javascript
const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  image: { type: String },
  refreshToken: { type: String }, // OAuth refresh token
  tier: { type: String, default: 'free' }, // free|pro|annual|deepclean
  usage: {
    cleanupCount: { type: Number, default: 0 },
    monitorCount: { type: Number, default: 0 },
    resetAt: { type: Date, default: () => new Date() },
  },
}, { timestamps: true })
```

**Key fields:**

| Field | Purpose |
|-------|---------|
| `googleId` | Unique Google ID (oauth2.sub) - indexed for lookups |
| `email` | Stored for display, billing, etc. |
| `refreshToken` | Secret - allows calling Gmail API without user present |
| `tier` | Feature gate - determines batch size limits |
| `usage.cleanupCount` | Monthly usage - reset on month boundary |

### Email Model

```javascript
const EmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messageId: { type: String, required: true },
  threadId: { type: String },
  from: { type: String },
  subject: { type: String },
  date: { type: String },
  labelIds: { type: [String], default: [] },
  snippet: { type: String },
  headers: { type: mongoose.Schema.Types.Mixed },
  
  // Classification
  category: { type: String, default: null },
  confidence: { type: Number, default: null },
  classificationSource: { type: String, default: null }, // rules|domain|ai|user
  
  // Processing state
  isProcessed: { type: Boolean, default: false },
  hasAttachment: { type: Boolean, default: false },
  actionTaken: { type: String, default: null }, // archive|trash|label
  
  source: { type: String, enum: ["scanned", "monitored"], default: "scanned" },
  monitoredAt: { type: Date, default: null },
}, { timestamps: true })

// Compound unique index - prevents duplicate emails
EmailSchema.index({ userId: 1, messageId: 1 }, { unique: true })
```

**Why compound index?**

```
Index: { userId: 1, messageId: 1 }

Allows:
✓ Fast lookup by userId + messageId
✓ Prevents duplicate (same user, same message)
✓ MongoDB throws error if you try to insert duplicate

Example:
User 1 scans inbox → Saves 500 emails
User 1 scans inbox AGAIN → Upsert updates, no duplicates
User 2 scans inbox → Saves 500 emails (different userId, OK)
```

---

## 21. [lib/mongoose.js](lib/mongoose.js) - Database Connection Management

### What it does
- Manages MongoDB connection lifecycle
- Caches connection to avoid recreating on every request
- Provides detailed error diagnostics

### Important Next.js Pattern: Connection Caching

```javascript
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  // If connected, return cached connection
  if (cached.conn) {
    console.log('MongoDB: using cached connection')
    return cached.conn
  }

  // If promise exists, wait for it (prevent duplicate connections)
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI)
      .then(...)
      .catch(...)
  }

  cached.conn = await cached.promise
  return cached.conn
}
```

**Why cache?**

```
Problem in Next.js:
- serverless functions spin up new Node processes
- Each process creates new MongoDB connection
- Too many connections = server overload

Solution:
- Store connection on global object
- Next request reuses same connection
- Dramatically reduces connection count

Example:
Without caching: 10,000 requests → 10,000 connections
With caching: 10,000 requests → 1-5 connections
```

**Why use Promise?**

```
Race condition without it:

Request 1 calls connectDB():
  - cached.promise doesn't exist
  - Starts connection (takes 100ms)
  
Request 2 calls connectDB() (before Request 1 finishes):
  - cached.promise still doesn't exist (Request 1 hasn't set it)
  - Starts ANOTHER connection (takes 100ms)
  
Result: 2 connections

With Promise:

Request 1 calls connectDB():
  - Sets cached.promise = connection promise
  - Waits for it
  
Request 2 calls connectDB() (before Request 1 finishes):
  - cached.promise already exists
  - Waits for same promise
  
Result: 1 connection
```

### Error Diagnostics

```javascript
.catch((error) => {
  if (error.name === 'MongoNetworkError') {
    console.error('MongoDB: Network error — check Atlas IP whitelist')
  } else if (error.name === 'MongoParseError') {
    console.error('MongoDB: URI parse error')
  } else if (error.code === 8000) {
    console.error('MongoDB: Auth failed — wrong username or password')
  }
})
```

**Helps developers debug common issues:**

| Error | Cause | Solution |
|-------|-------|----------|
| `MongoNetworkError` | Can't reach MongoDB server | Add IP to whitelist, check network |
| `MongoParseError` | Connection string malformed | Check `MONGODB_URI` format |
| Code 8000 | Auth failed | Check username/password |

---

# NEXT.JS SPECIFIC CONCEPTS

## 1. Route Handlers vs Components

| File | Type | Runs Where | Use Case |
|------|------|-----------|----------|
| `/app/page.js` | Component | Browser + Server | UI rendering |
| `/app/api/route.js` | Route Handler | Server only | API endpoints |

## 2. Server vs Client Components

**Server Component (default):**
```javascript
// No 'use client' directive
export default async function Page() {
  await connectDB() // Can do server-only operations
  const data = await fetch(...) // fetches on server
  return <UI data={data} />
}
```

**Client Component:**
```javascript
'use client' // Required for useState, useEffect, etc.
export default function Component() {
  const [state, setState] = useState()
  // Can call API using fetch()
}
```

## 3. `async` Server Components

```javascript
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  return <Dashboard />
}
```

**This is Next.js 13+ feature:**
- Can use `await` in server component body
- Results rendered on server before sending to browser
- Faster than client-side data fetching

## 4. `redirect()` vs `useRouter().push()`

**Server Component:**
```javascript
if (!session) {
  redirect('/') // Server-side redirect - happens before rendering
}
```

**Client Component:**
```javascript
if (!session) {
  useRouter().push('/') // Client-side navigation
}
```

## 5. API Routes (`/app/api/`)

```
/app/api/gmail/count/route.js
        ↓
GET /api/gmail/count
```

File structure maps to URL structure automatically.

## 6. Dynamic Routes (`[paramName]`)

```
/app/api/emails/[messageId]/route.js
        ↓
PATCH /api/emails/123456
       ↑ messageId = "123456"
```

Accessed via: `{ params: { messageId } }`

## 7. Search Parameters

```javascript
const { searchParams } = new URL(request.url)
const category = searchParams.get('category')
const page = searchParams.get('page')

// /api/emails?category=Finance&page=2
// category = "Finance", page = "2"
```

## 8. Request Body Parsing

```javascript
export async function POST(request) {
  const body = await request.json() // Parse JSON body
  const { action, category } = body
}
```

## 9. Response Objects

```javascript
// All responses return Web Standard Response objects
return Response.json({ data: {} }, { status: 200 })
return Response.json({ error: '...' }, { status: 400 })
return new Response(stream, { headers: { ... } })
```

---

# DATABASE & MONGODB

## 1. Mongoose Schemas

```javascript
const schema = new mongoose.Schema({
  fieldName: {
    type: String,
    required: true,
    unique: true,
    index: true,
  }
})
```

| Property | Meaning |
|----------|---------|
| `type` | Field data type |
| `required` | Must provide when creating |
| `unique` | No duplicates allowed |
| `index` | Creates database index for fast lookups |

## 2. Indexes

**Compound Index:**
```javascript
schema.index({ userId: 1, messageId: 1 }, { unique: true })
```

- `userId: 1`: ascending order
- `messageId: 1`: ascending order
- `unique: true`: No duplicates

**B-tree structure:** MongoDB maintains sorted index for fast lookups
- Without: `User.find({ userId })` scans all documents (slow)
- With: Jumps directly to user's documents (fast)

## 3. Model Relationships

```javascript
{
  userId: mongoose.Schema.Types.ObjectId,  // Reference to User
  ref: "User"  // Population hint
}
```

Allows: `Email.populate('userId')` to get full user object

## 4. Aggregation Pipeline

```javascript
const result = await Email.aggregate([
  {
    $match: {
      userId: user._id,
      isProcessed: true,
      category: { $ne: null }
    }
  },
  {
    $group: {
      _id: '$category',
      count: { $sum: 1 }
    }
  }
])
```

**$match**: Filter documents (like WHERE) 
**$group**: Group by field, count each group

Result:
```javascript
[
  { _id: 'Finance', count: 15 },
  { _id: 'Spam', count: 8 },
  ...
]
```

---

# API INTEGRATIONS

## 1. Google Gmail API

**Initialization:**
```javascript
const googleapis  = require('googleapis')
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT)
oauth2Client.setCredentials({ refresh_token })
const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
```

**Key Operations:**
- `gmail.users.getProfile()` - Get mailbox count
- `gmail.users.messages.list()` - Fetch message IDs
- `gmail.users.messages.get()` - Fetch email metadata
- `gmail.users.messages.batchModify()` - Archive/label emails
- `gmail.users.labels.create()` - Create label
- `gmail.users.labels.list()` - List existing labels

## 2. Google Gemini AI API

**Initialization:**
```javascript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
```

**Usage:**
```javascript
const result = await model.generateContent(prompt)
const text = result.response.text()
```

**Why Flash Lite?**
- Cost: ~$0.075 per 1M input tokens
- Speed: <500ms per request
- Quality: Good enough for email classification
- vs GPT-4: 25x more expensive, slower

## 3. NextAuth with Google OAuth

**Scopes requested:**
```
openid, email, profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.labels
https://www.googleapis.com/auth/gmail.modify
```

**Flow:**
1. User clicks "Sign in with Google"
2. Google shows consent screen
3. User approves scopes
4. Google returns authorization code
5. NextAuth exchanges code for tokens
6. We save refresh_token in MongoDB
7. Ready to use Gmail API

---

# AUTHENTICATION FLOW

## Complete Auth Journey

```
1. Landing Page (public)
   └─ User clicks "Sign in with Google"
   
2. Google OAuth Modal
   └─ User enters credentials
   
3. Consent Screen
   └─ "Allow MailClean to access your Gmail?"
   └─ User clicks "Allow"
   
4. authOptions.signIn callback
   └─ Google returns user info + tokens
   └─ We check if user exists in DB
   └─ If yes: Update refreshToken
   └─ If no: Create user document
   
5. JWT Token Created
   └─ authOptions.jwt callback
   └─ Fetch user tier from DB
   └─ Store in token
   
6. Session Callback
   └─ authOptions.session callback
   └─ Copy data from JWT to session object
   
7. Redirect to Dashboard
   └─ useSession() returns session object
   └─ User sees dashboard
   
8. Background Operations
   └─ We have refreshToken in DB
   └─ Can call Gmail API anytime
   └─ User doesn't need to be online
```

## Session Lifecycle

```
User logs in:
  → NextAuth creates JWT token
  → Token valid for X days
  → Stored in secure HTTP-only cookie

User visits dashboard:
  → Browser sends cookie with request
  → getServerSession() validates cookie
  → Reads JWT contents
  → Checks expiration
  → If expired → Refresh using refresh_token
  → If valid → Return user data

User logs out:
  → NextAuth clears cookie
  → Session destroyed
  → No more access to protected pages
```

---

# EMAIL CLASSIFICATION PIPELINE

## Complete Flow Diagram

```
User Email in Gmail
       ↓
[Phase 1] Scan Gmail
  - Fetch 100-5000 message IDs (based on tier)
  - Fetch metadata for each (headers only, no body)
  - Save to MongoDB
       ↓
[Phase 2] Classification (Streaming via SSE)
  - Layer 1: Rules-based classification
    Check subject line patterns (OTP, transaction, etc)
    If confidence >= 0.85 → Done
    Else → Next layer
  
  - Layer 2: Domain reputation lookup
    Check sender domain (HDFC=Finance, Swiggy=Receipts)
    If known domain → Done
    Else → Next layer
  
  - Layer 3: Gemini AI
    Send to Gemini API for classification
    Return category + confidence
       ↓
[Phase 3] Actions
  - User reviews summary
  - User picks action: Archive / Trash / Label
  - Call Gmail API to execute
  - Mark as actioned in DB
       ↓
Email actioned in Gmail + Database updated
```

## Cost Optimization Through Classification Layers

```
Hypothetical: 1000 emails

Layer 1 (Rules):
  - Free
  - Classifies 600 emails (60%)
  - Cost: $0

Remaining 400 emails → Layer 2

Layer 2 (Domain):
  - Free
  - Classifies 280 emails (70% of remaining)
  - Cost: $0

Remaining 120 emails → Layer 3

Layer 3 (Gemini AI):
  - Paid
  - Classifies remaining 120 emails
  - ~50,000 tokens (rough estimate)
  - Cost: 50,000 × $0.075/1M = $0.004

Total cost for 1000 emails: $0.004
vs calling Gemini for all 1000: $0.1

Savings: 96%
```

---

## Summary

This codebase demonstrates:

1. **Next.js Architecture**: Server/Client boundary, API routes, Server Components
2. **OAuth Integration**: Google Sign-In with refresh tokens for background access
3. **Email Processing**: Privacy-first approach (headers only, never body)
4. **AI Integration**: Cost-optimized 3-layer classification
5. **MongoDB**: Connection caching, indexes, aggregation for performance
6. **Streaming**: Server-Sent Events for real-time progress updates
7. **API Design**: RESTful routes, pagination, batch operations
8. **India-First Approach**: Domain database built for Indian banks/services/e-commerce
