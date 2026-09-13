import { LuLightbulb, LuNotebookPen, LuSprout } from 'react-icons/lu'

import { FloatingHeader } from '@/components/floating-header'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { PageTitle } from '@/components/page-title'
import { ScrollArea } from '@/components/scroll-area'

const sections = [
  { key: 'log', label: 'Log', Icon: LuNotebookPen },
  { key: 'thoughts', label: 'Thoughts', Icon: LuLightbulb },
  { key: 'review', label: 'Review', Icon: LuSprout }
]

export function JournalEntry({ entry }) {
  const date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(entry.date))
  const title = entry.title === entry.date ? date : entry.title
  return (
    <ScrollArea key={entry.noteId} className="bg-white" useScrollAreaId>
      <FloatingHeader scrollTitle={title} goBackLink="/journey" />
      <div className="content-wrapper">
        <article className="content" aria-label={title}>
          <PageTitle
            title={title}
            subtitle={
              entry.title !== entry.date && (
                <time dateTime={entry.date} className="text-sm text-gray-400">
                  {date}
                </time>
              )
            }
            className="mb-8 flex flex-col gap-3"
          />
          {!!entry.tags.length && (
            <div className="mb-8 flex flex-wrap gap-2" aria-label="Tags">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-gray-100 px-2 py-1 text-xs break-all text-gray-500">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-10">
            {sections
              .filter(({ key }) => entry[key])
              .map(({ key, label, Icon }) => (
                <section key={key} aria-label={label}>
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500">
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </h2>
                  <MarkdownRenderer
                    className="journal-prose block text-base leading-8 text-gray-700"
                    options={{
                      disableParsingRawHTML: true,
                      overrides: {
                        p: ({ children }) => <p className="mb-4 text-base leading-8">{children}</p>,
                        h3: ({ children }) => <h3 className="mt-6 mb-3 text-lg font-semibold">{children}</h3>
                      }
                    }}
                  >
                    {entry[key]}
                  </MarkdownRenderer>
                </section>
              ))}
          </div>
        </article>
      </div>
    </ScrollArea>
  )
}
