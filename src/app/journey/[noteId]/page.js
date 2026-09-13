import { notFound } from 'next/navigation'

import { JournalEntry } from '@/components/journal-entry'
import { getJournalEntries } from '@/lib/journal'
import { journalExcerpt } from '@/lib/journal-data'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

async function getEntry(params) {
  const [{ noteId }, entries] = await Promise.all([params, getJournalEntries()])
  const entry = entries.find((entry) => entry.noteId === noteId)
  return entry
}

export default async function JourneyEntryPage({ params }) {
  const entry = await getEntry(params)
  if (!entry) notFound()
  return <JournalEntry entry={entry} />
}

export async function generateMetadata({ params }) {
  const [entry, { siteBaseUrl }] = await Promise.all([getEntry(params), getSiteMetadata()])
  if (!entry) return { title: 'Entry not found', robots: { index: false } }
  const url = buildAbsoluteUrl(siteBaseUrl, `journey/${entry.noteId}`)
  const title = entry.title
  const description = journalExcerpt(entry)
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: 'article', url } }
}
