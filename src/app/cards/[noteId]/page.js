import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { CardsExplorer } from '@/components/cards/cards-explorer'
import { FloatingHeader } from '@/components/floating-header'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getAllPermanentNotes, getPermanentNote } from '@/lib/permanent-notes'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

export async function generateMetadata({ params }) {
  const { noteId } = await params
  const [note, { siteBaseUrl }] = await Promise.all([getPermanentNote(noteId), getSiteMetadata()])
  if (!note) notFound()

  const title = note.title || note.titleEn || note.noteId
  const description =
    (note.bodyZh || note.bodyEn)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[#*_`>~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || `${title} — 永久笔记 · Permanent note`
  const url = buildAbsoluteUrl(siteBaseUrl, `cards/${encodeURIComponent(note.noteId)}`)

  return {
    title,
    description,
    keywords: note.tags,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'article', url },
    twitter: { card: 'summary', title, description }
  }
}

async function NoteDetail({ params, searchParams }) {
  const [{ noteId }, notes, query] = await Promise.all([params, getAllPermanentNotes(), searchParams])
  const note = notes.find((item) => item.noteId === noteId)
  if (!note) notFound()

  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader title="Cards · 卡片盒" goBackLink="/cards" />
      <CardsExplorer
        notes={notes}
        initialNoteId={noteId}
        initialTag={typeof query?.tag === 'string' ? query.tag : undefined}
        initialView={query?.view}
        initialLevel={query?.level}
      />
    </ScrollArea>
  )
}

export default function CardPage({ params, searchParams }) {
  return (
    <Suspense fallback={<ScreenLoadingSpinner />}>
      <NoteDetail params={params} searchParams={searchParams} />
    </Suspense>
  )
}
