'use client'

import throttle from 'lodash.throttle'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { LuChevronRight as ChevronRightIcon, LuListTree as ListTreeIcon } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { SCROLL_AREA_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'

const ACTIVE_HEADING_OFFSET = 120
const MIN_HEADINGS_FOR_TOC = 2
const SCROLL_THROTTLE_MS = 50

export function TableOfContents({ headings, className, onCollapse }) {
  if (!shouldRenderToc(headings)) {
    return null
  }

  return (
    <aside className={className}>
      <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-black">
            <ListTreeIcon size={16} />
            On this page
          </div>
          {onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              title="Hide table of contents"
              aria-label="Hide table of contents"
              onClick={onCollapse}
            >
              <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
        <TableOfContentsNav headings={headings} />
      </div>
    </aside>
  )
}

export const MobileTableOfContents = memo(({ headings }) => {
  const [open, setOpen] = useState(false)

  const handleNavigate = useCallback(() => {
    setOpen(false)
  }, [])

  if (!shouldRenderToc(headings)) {
    return null
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" title="Open table of contents" aria-label="Open table of contents">
          <ListTreeIcon size={16} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[75dvh]">
        <DrawerHeader>
          <DrawerTitle>On this page</DrawerTitle>
          <DrawerDescription>Jump to a section in this article.</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <TableOfContentsNav headings={headings} onNavigate={handleNavigate} />
        </div>
      </DrawerContent>
    </Drawer>
  )
})
MobileTableOfContents.displayName = 'MobileTableOfContents'

const TableOfContentsNav = memo(({ headings, onNavigate }) => {
  const [activeId, setActiveId] = useState(() => headings[0]?.id ?? '')

  const navigateToHeading = useCallback(
    (headingId) => {
      const target = document.getElementById(headingId)
      if (!target) {
        return
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })

      window.history.replaceState(null, '', `#${headingId}`)
      setActiveId(headingId)
      onNavigate?.()
    },
    [onNavigate]
  )

  useEffect(() => {
    if (headings.length === 0) {
      return undefined
    }

    const scrollArea = document.getElementById(SCROLL_AREA_ID)
    if (!scrollArea) {
      return undefined
    }

    const updateActiveHeading = () => {
      const nextActiveId = getActiveHeadingId(headings, scrollArea)
      if (nextActiveId) {
        setActiveId(nextActiveId)
      }
    }

    const throttledUpdateActiveHeading = throttle(updateActiveHeading, SCROLL_THROTTLE_MS)

    updateActiveHeading()
    scrollArea.addEventListener('scroll', throttledUpdateActiveHeading, { passive: true })
    window.addEventListener('hashchange', updateActiveHeading)

    return () => {
      scrollArea.removeEventListener('scroll', throttledUpdateActiveHeading)
      window.removeEventListener('hashchange', updateActiveHeading)
      throttledUpdateActiveHeading.cancel()
    }
  }, [headings])

  const items = useMemo(
    () =>
      headings.map((heading) => {
        const isActive = heading.id === activeId

        return (
          <li key={heading.id}>
            <button
              type="button"
              onClick={() => navigateToHeading(heading.id)}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-200',
                heading.level === 3 && 'pl-5 text-gray-600',
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {heading.text}
            </button>
          </li>
        )
      }),
    [activeId, headings, navigateToHeading]
  )

  return (
    <nav aria-label="Table of contents">
      <ol className="space-y-1">{items}</ol>
    </nav>
  )
})
TableOfContentsNav.displayName = 'TableOfContentsNav'

function shouldRenderToc(headings) {
  return Array.isArray(headings) && headings.length >= MIN_HEADINGS_FOR_TOC
}

function getActiveHeadingId(headings, scrollArea) {
  const scrollAreaTop = scrollArea.getBoundingClientRect().top
  let activeHeadingId = headings[0]?.id ?? ''

  for (const heading of headings) {
    const element = document.getElementById(heading.id)
    if (!element) {
      continue
    }

    const top = element.getBoundingClientRect().top - scrollAreaTop

    if (top <= ACTIVE_HEADING_OFFSET) {
      activeHeadingId = heading.id
      continue
    }

    break
  }

  return activeHeadingId
}
