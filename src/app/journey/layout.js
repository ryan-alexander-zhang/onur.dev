import { Suspense } from 'react'

import { JourneyTimeline } from '@/components/journey-timeline'
import { SideMenu } from '@/components/side-menu'
import { getJournalEntries } from '@/lib/journal'

async function JournalNavigation() {
  return <JourneyTimeline entries={await getJournalEntries()} />
}

export default function JourneyLayout({ children }) {
  return (
    <>
      <Suspense fallback={<div className="hidden border-r bg-zinc-50 lg:block lg:w-80 lg:shrink-0 xl:w-96" />}>
        <SideMenu title="Journey" isInner>
          <JournalNavigation />
        </SideMenu>
      </Suspense>
      <div className="lg:bg-dots min-w-0 flex-1">{children}</div>
    </>
  )
}
