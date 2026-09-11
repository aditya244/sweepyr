import { getGmailClient } from './gmail'

// Creates a label in Gmail if it doesn't already exist.
// Returns the label ID which we need for applying labels.
export async function getOrCreateLabel(refreshToken, labelName) {
  const gmail = getGmailClient(refreshToken)

  // First check if label already exists
  const existing = await gmail.users.labels.list({ userId: 'me' })
  const found = existing.data.labels.find(l => l.name === labelName)
  if (found) return found.id

  // Create it if not found
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

// Creates the full Sweepyr label hierarchy in Gmail
// e.g. Sweepyr/Finance, Sweepyr/Receipts etc.
export async function createSweepyrLabels(refreshToken, categories) {
  const labelIds = {}

  for (const category of categories) {
    const labelName = `Sweepyr/${category}`
    const labelId = await getOrCreateLabel(refreshToken, labelName)
    labelIds[category] = labelId
  }

  return labelIds
}

// Archives a batch of emails — removes INBOX label
// Emails remain in All Mail and are fully recoverable
export async function archiveEmails(refreshToken, messageIds) {
  const gmail = getGmailClient(refreshToken)

  // Gmail batch modify handles up to 1000 message IDs at once
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

// Moves emails to Trash — recoverable for 30 days from Gmail
// We never call messages.delete — always Trash instead
export async function trashEmails(refreshToken, messageIds) {
  const gmail = getGmailClient(refreshToken)

  // Trash doesn't have a batch endpoint — must call individually
  // We process with Promise.allSettled so one failure doesn't stop the rest
  const chunks = chunkArray(messageIds, 50) // 50 at a time to avoid rate limits
  let trashed = 0

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(id => gmail.users.messages.trash({ userId: 'me', id }))
    )
    trashed += results.filter(r => r.status === 'fulfilled').length

    // Small delay between chunks to respect rate limits
    if (chunks.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return trashed
}

// Applies a Gmail label to a batch of emails
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

// Splits an array into chunks of a given size
function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}