'use client'

import { LuBookOpen, LuLightbulb, LuNotebookPen, LuSprout } from 'react-icons/lu'

import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Timeline, TimelineItem } from '@/components/timeline/timeline'
import { groupJournalByYear } from '@/lib/journal-data'

const sections = [
  { key: 'log', label: 'Log', Icon: LuNotebookPen },
  { key: 'thoughts', label: 'Thoughts', Icon: LuLightbulb },
  { key: 'review', label: 'Review', Icon: LuSprout }
]

function JournalSections({ entry }) {
  return (
    <div className="space-y-6">
      {sections
        .filter(({ key }) => entry[key])
        .map(({ key, label, Icon }) => (
          <section key={key} aria-label={label}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500">
              <Icon size={14} aria-hidden="true" />
              {label}
            </h3>
            <MarkdownRenderer
              className="journal-prose block text-sm leading-7 text-gray-700"
              options={{
                disableParsingRawHTML: true,
                overrides: {
                  h3: ({ children }) => <h4 className="mt-4 mb-2 text-sm font-medium text-gray-900">{children}</h4>,
                  h4: ({ children }) => <h5 className="mt-3 mb-2 text-sm font-medium text-gray-900">{children}</h5>
                }
              }}
            >
              {entry[key]}
            </MarkdownRenderer>
          </section>
        ))}
    </div>
  )
}

export function JourneyTimeline({ entries }) {
  const groups = groupJournalByYear(entries)
  if (!groups.length)
    return (
      <div className="mt-12 rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
        <LuBookOpen className="mx-auto mb-4 text-gray-400" size={24} aria-hidden="true" />
        <h2 className="text-base font-medium">More along the way</h2>
        <p className="mt-2 mb-0 text-sm text-gray-500">Notes and reflections will appear here.</p>
      </div>
    )
  return (
    <div className="mt-10 space-y-12">
      {groups.map(({ year, entries }) => (
        <section key={year} aria-labelledby={`journey-${year}`}>
          <div className="mb-6 flex items-center gap-4">
            <h2 id={`journey-${year}`} className="text-lg font-semibold tracking-tight">
              {year}
            </h2>
            <div className="h-px flex-1 bg-gray-200/70" />
          </div>
          <Timeline
            iconsize="sm"
            className="m-0 min-h-0 max-w-none list-none gap-0 p-0"
            aria-label={`${year} journal entries`}
          >
            {entries.map((entry) => (
              <TimelineItem
                key={entry.noteId}
                id={`entry-${entry.noteId}`}
                date={entry.date}
                icon={<LuNotebookPen size={14} />}
              >
                <article className="min-w-0 rounded-2xl border border-gray-200/80 bg-white/85 p-5 shadow-xs sm:p-6">
                  {entry.title !== entry.date && (
                    <h2 className="mb-3 text-lg leading-snug font-semibold break-words">{entry.title}</h2>
                  )}
                  {!!entry.tags.length && (
                    <div className="mb-5 flex flex-wrap gap-2" aria-label="Tags">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-gray-100 px-2 py-1 text-xs break-all text-gray-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {['log', 'thoughts', 'review'].reduce((n, key) => n + entry[key].length, 0) > 1200 ? (
                    <details className="group">
                      <summary className="cursor-pointer rounded-sm text-sm font-medium text-gray-600 outline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600">
                        <span className="group-open:hidden">Read entry</span>
                        <span className="hidden group-open:inline">Close entry</span>
                      </summary>
                      <div className="mt-5">
                        <JournalSections entry={entry} />
                      </div>
                    </details>
                  ) : (
                    <JournalSections entry={entry} />
                  )}
                </article>
              </TimelineItem>
            ))}
          </Timeline>
        </section>
      ))}
    </div>
  )
}
