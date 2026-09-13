import NextLink from 'next/link'

import { FloatingHeader } from '@/components/floating-header'
import { ScrollArea } from '@/components/scroll-area'

export default function JournalNotFound() {
  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader title="Journey" goBackLink="/journey" />
      <div className="content-wrapper">
        <div className="content">
          <h1>Entry not found</h1>
          <p className="mt-4 text-gray-500">This entry is unavailable.</p>
          <NextLink className="link" href="/journey">
            Back to Journey
          </NextLink>
        </div>
      </div>
    </ScrollArea>
  )
}
