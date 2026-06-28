'use client'

import { useState } from 'react'
import { LuChevronLeft as ChevronLeftIcon } from 'react-icons/lu'

import { TableOfContents } from '@/components/contentful/table-of-contents'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MIN_HEADINGS_FOR_TOC = 2

export function ContentLayoutWithToc({ headings, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const hasToc = headings.length >= MIN_HEADINGS_FOR_TOC

  if (!hasToc) {
    return <div className="content xl:max-w-3xl">{children}</div>
  }

  return (
    <>
      <div className={cn('content transition-[max-width] duration-300', isCollapsed ? 'xl:max-w-3xl' : 'xl:max-w-6xl')}>
        <div className={cn(!isCollapsed && 'xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10')}>
          <article className="min-w-0 xl:max-w-3xl">{children}</article>
          {!isCollapsed && (
            <TableOfContents
              headings={headings}
              className="hidden xl:block"
              onCollapse={() => {
                setIsCollapsed(true)
              }}
            />
          )}
        </div>
      </div>
      {isCollapsed && (
        <div className="pointer-events-none fixed top-1/2 right-6 z-20 hidden -translate-y-1/2 xl:block">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="pointer-events-auto rounded-full bg-white shadow-sm"
            title="Show table of contents"
            aria-label="Show table of contents"
            onClick={() => {
              setIsCollapsed(false)
            }}
          >
            <ChevronLeftIcon size={16} />
          </Button>
        </div>
      )}
    </>
  )
}
