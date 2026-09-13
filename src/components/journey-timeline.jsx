'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { LuNotebookPen } from 'react-icons/lu'

import { Timeline, TimelineItem, TimelineTime } from '@/components/timeline/timeline'
import { groupJournalByYear, journalExcerpt } from '@/lib/journal-data'
import { cn } from '@/lib/utils'

export function JourneyTimeline({ entries }) {
  const pathname = usePathname()
  const groups = groupJournalByYear(entries)
  if (!groups.length) return <p className="px-2 py-6 text-sm text-gray-500">Notes and reflections will appear here.</p>
  return (
    <nav aria-label="Journal timeline" className="space-y-8 px-2 py-3">
      {groups.map(({ year, entries }) => (
        <section key={year} aria-labelledby={`journey-${year}`}>
          <div className="mb-5 flex items-center gap-3">
            <h2 id={`journey-${year}`} className="text-sm font-semibold tracking-tight">
              {year}
            </h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <Timeline
            iconsize="sm"
            className="m-0 min-h-0 max-w-none list-none gap-0 p-0"
            aria-label={`${year} journal entries`}
          >
            {entries.map((entry) => {
              const href = `/journey/${entry.noteId}`
              const active = pathname === href
              return (
                <TimelineItem
                  key={entry.noteId}
                  compact
                  date={entry.date}
                  icon={<LuNotebookPen size={14} />}
                  iconColor={active ? 'primary' : 'muted'}
                >
                  <NextLink
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                      active ? 'bg-black text-white' : 'hover:bg-gray-200'
                    )}
                  >
                    <TimelineTime
                      date={entry.date}
                      format={{ month: 'short', day: '2-digit', year: undefined }}
                      className={cn('block font-semibold', active ? 'text-white' : 'text-gray-900')}
                    />
                    <span
                      className={cn(
                        'mt-1 line-clamp-2 leading-5 break-words',
                        active ? 'text-slate-300' : 'text-gray-500'
                      )}
                    >
                      {entry.title !== entry.date ? entry.title : journalExcerpt(entry)}
                    </span>
                  </NextLink>
                </TimelineItem>
              )
            })}
          </Timeline>
        </section>
      ))}
    </nav>
  )
}
