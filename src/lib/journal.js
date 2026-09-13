import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { fetchJournalEntries, JOURNAL_CACHE_TAG } from '@/lib/journal-data'

export async function getJournalEntries() {
  'use cache'
  cacheLife('hours')
  cacheTag(JOURNAL_CACHE_TAG)
  return fetchJournalEntries()
}
