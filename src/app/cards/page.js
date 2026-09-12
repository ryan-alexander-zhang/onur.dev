import { Suspense } from 'react'

import { CardsExplorer } from '@/components/cards/cards-explorer'
import { FloatingHeader } from '@/components/floating-header'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getAllPermanentNotes } from '@/lib/permanent-notes'

export const metadata = {
  title: 'Cards · 卡片盒',
  description: '一个想法，一张卡片。探索按标签整理的双语永久笔记，以及想法之间的连接。',
  alternates: { canonical: '/cards' }
}

async function Collection({ searchParams }) {
  const [notes, query] = await Promise.all([getAllPermanentNotes(), searchParams])
  return (
    <CardsExplorer
      notes={notes}
      initialTag={typeof query?.tag === 'string' ? query.tag : undefined}
      initialView={query?.view}
      initialLevel={query?.level}
    />
  )
}

export default function CardsPage({ searchParams }) {
  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader title="Cards · 卡片盒" />
      <Suspense fallback={<ScreenLoadingSpinner />}>
        <Collection searchParams={searchParams} />
      </Suspense>
    </ScrollArea>
  )
}
