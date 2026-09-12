import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { fetchPermanentNotes, PERMANENT_NOTES_CACHE_TAG } from '@/lib/permanent-notes-data'

async function getPublishedPermanentNotes() {
  'use cache'
  cacheLife('hours')
  cacheTag(PERMANENT_NOTES_CACHE_TAG)
  return fetchPermanentNotes()
}

export async function getAllPermanentNotes(preview = false) {
  return preview ? fetchPermanentNotes({ preview: true }) : getPublishedPermanentNotes()
}

export async function getPermanentNote(noteId, preview = false) {
  const notes = await getAllPermanentNotes(preview)
  return notes.find((note) => note.noteId === noteId) ?? null
}
