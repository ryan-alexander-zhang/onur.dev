'use client'

import { useEffect, useRef, useState } from 'react'
import { LuLink2 as Link2Icon } from 'react-icons/lu'

export const BookmarkCard = ({ bookmark, order, selectedTags = [], onTag, groupTitle }) => {
  const [expanded, setExpanded] = useState(false)
  const coverRef = useRef(null)
  useEffect(() => {
    const image = coverRef.current
    // A remote image can fail before React hydrates its error handler.
    if (image?.complete && !image.naturalWidth) image.src = '/assets/fallback.avif'
  }, [bookmark.cover])
  const tags = [...bookmark.tags].sort((a, b) => Number(selectedTags.includes(b)) - Number(selectedTags.includes(a)))
  return (
    <article
      data-bookmark-order={order}
      className="thumbnail-shadow flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl bg-white p-4"
    >
      <a
        className="group flex min-w-0 flex-col gap-4 rounded-lg"
        href={bookmark.link}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="aspect-1200/630 overflow-hidden rounded-lg">
          <img
            ref={coverRef}
            src={bookmark.cover || '/assets/fallback.avif'}
            alt={bookmark.title}
            width={1200}
            height={630}
            loading={order < 2 ? 'eager' : 'lazy'}
            className="aspect-1200/630 w-full rounded-lg border object-cover"
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('/assets/fallback.avif')) e.currentTarget.src = '/assets/fallback.avif'
            }}
            nopin="nopin"
          />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          {groupTitle && <span className="text-xs text-gray-500">{groupTitle}</span>}
          <h2 className="line-clamp-4 text-lg leading-snug break-words group-hover:underline">{bookmark.title}</h2>
          <span className="inline-flex items-center gap-1 text-sm text-gray-500">
            <Link2Icon size={16} className="shrink-0" />
            <span className="truncate">{bookmark.domain}</span>
          </span>
          <span className="line-clamp-6 text-sm break-words">{bookmark.excerpt || bookmark.note}</span>
        </div>
      </a>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Bookmark tags">
          {(expanded ? tags : tags.slice(0, 3)).map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => onTag?.(tag)}
              aria-pressed={selectedTags.includes(tag)}
              aria-label={`Filter by ${tag}`}
              className={`max-w-full rounded-md px-2 py-1 text-left text-xs break-words transition-colors ${selectedTags.includes(tag) ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {tag}
            </button>
          ))}
          {tags.length > 3 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              {expanded ? 'Less' : `+${tags.length - 3}`}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
