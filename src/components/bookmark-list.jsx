'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { BookmarkCard } from '@/components/bookmark-card'
import { BookmarkSearch } from '@/components/bookmark-search'
import { Button } from '@/components/ui/button'
import { bookmarkTagOptions, filterBookmarks, readBookmarkFilters } from '@/lib/bookmark-filters'

export const BookmarkList = ({ catalog, id = '' }) => {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const filters = useMemo(() => ({ ...readBookmarkFilters(params), group: id, sort: 'latest' }), [params, id])
  const results = useMemo(() => filterBookmarks(catalog.items, filters), [catalog, filters])
  const options = useMemo(() => bookmarkTagOptions(catalog.items, filters), [catalog, filters])
  const [pagination, setPagination] = useState({ key: '', limit: 50 })
  const pageKey = pathname + '?' + params.toString()
  const limit = pagination.key === pageKey ? pagination.limit : 50
  const visible = results.slice(0, limit)
  const update = (changes, replace = false) => {
    const next = new URLSearchParams(params.toString())
    if (changes.query !== undefined) {
      if (changes.query) next.set('q', changes.query)
      else next.delete('q')
    }
    if (changes.tags) {
      next.delete('tag')
      for (const tag of changes.tags) next.append('tag', tag)
    }
    next.delete('sort')
    const url = pathname + (next.size ? '?' + next.toString() : '')
    if (url !== pageKey.replace(/\?$/, '')) window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  }
  const addTag = (tag) => {
    if (!filters.tags.includes(tag)) update({ tags: [...filters.tags, tag] })
  }
  const switchGroup = (group) => {
    router.push(`/bookmarks${group ? '/' + group : ''}${params.size ? '?' + params.toString() : ''}`)
  }
  const clear = () => update({ query: '', tags: [] })
  const renderCard = (bookmark, order) => (
    <BookmarkCard
      key={bookmark._id}
      bookmark={bookmark}
      order={order}
      selectedTags={filters.tags}
      onTag={addTag}
      groupTitle={!id ? catalog.groups.find((g) => g._id === bookmark.collectionId)?.title : undefined}
    />
  )

  return (
    <div className="min-w-0">
      <BookmarkSearch
        query={filters.query}
        tags={filters.tags}
        options={options}
        onChange={update}
        count={results.length}
      />
      <div className="flex flex-col gap-4 @lg:hidden">{visible.map(renderCard)}</div>
      <div className="hidden @lg:grid @lg:grid-cols-2 @lg:gap-4">
        {[0, 1].map((column) => (
          <div key={column} className="grid min-w-0 place-content-start gap-4">
            {visible.filter((_, index) => index % 2 === column).map(renderCard)}
          </div>
        ))}
      </div>
      {results.length > limit ? (
        <Button
          variant="outline"
          className="mt-8 w-full bg-white"
          onClick={() => setPagination({ key: pageKey, limit: limit + 50 })}
        >
          Load more
        </Button>
      ) : results.length > 0 ? (
        <p className="my-8 text-center text-sm text-gray-500">That's all for now. Come back later for more.</p>
      ) : (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <p className="font-medium">No bookmarks found.</p>
          <p className="mt-2 text-sm text-gray-500">Try fewer tags or a different search.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={clear}>
              Clear filters
            </Button>
            {id && (
              <Button variant="outline" onClick={() => switchGroup('')}>
                View all groups
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
