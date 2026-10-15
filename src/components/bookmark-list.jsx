'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { BookmarkCard } from '@/components/bookmark-card'
import { BookmarkSearch } from '@/components/bookmark-search'
import { Button } from '@/components/ui/button'
import { bookmarkTagOptions, filterBookmarks, readBookmarkFilters } from '@/lib/bookmark-filters'

export const BookmarkList = ({ catalog, id = '', semanticEnabled = false }) => {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const filters = useMemo(() => ({ ...readBookmarkFilters(params), group: id, sort: 'latest' }), [params, id])
  const localResults = useMemo(() => filterBookmarks(catalog.items, filters), [catalog, filters])
  // Natural-language queries should not hide tags before AI search has even run.
  const options = useMemo(() => bookmarkTagOptions(catalog.items, { ...filters, query: '' }), [catalog, filters])
  const [pagination, setPagination] = useState({ key: '', limit: 50 })
  const pageKey = pathname + '?' + params.toString()
  const [semantic, setSemantic] = useState(null)
  const requestRef = useRef(null)
  const current = semantic?.key === pageKey && semantic.catalog === catalog ? semantic : null
  const results = useMemo(() => {
    if (current?.status !== 'success') return localResults
    const pool = new Map(filterBookmarks(catalog.items, { ...filters, query: '' }).map((item) => [item._id, item]))
    return current.ids.map((itemId) => pool.get(itemId)).filter(Boolean)
  }, [current, localResults, catalog, filters])
  const paginationKey = pageKey + (current?.status === 'success' ? ':semantic' : ':text')
  const limit = pagination.key === paginationKey ? pagination.limit : 50
  const visible = results.slice(0, limit)
  useEffect(() => {
    return () => {
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [pageKey, catalog])
  const resetSemantic = () => {
    requestRef.current?.abort()
    requestRef.current = null
    setSemantic(null)
  }
  const searchSemantic = async () => {
    const query = filters.query.trim()
    if (!semanticEnabled || query.length < 2 || current?.status === 'loading' || current?.status === 'success') return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const timer = setTimeout(() => controller.abort(), 12000)
    const context = { key: pageKey, catalog }
    setSemantic({ ...context, status: 'loading' })
    try {
      const response = await fetch('/api/bookmarks/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, group: id, tags: filters.tags }),
        signal: controller.signal
      })
      if (!response.ok) {
        const error = new Error('Search unavailable')
        error.status = response.status
        throw error
      }
      const data = await response.json()
      if (!Array.isArray(data.ids) || data.ids.some((itemId) => typeof itemId !== 'string'))
        throw new Error('Invalid results')
      if (requestRef.current === controller) setSemantic({ ...context, status: 'success', ids: [...new Set(data.ids)] })
    } catch (error) {
      if (requestRef.current === controller)
        setSemantic({
          ...context,
          status: 'error',
          message:
            error.status === 429
              ? 'Too many AI searches. Try again in a minute. Showing text matches.'
              : 'AI search unavailable. Showing text matches; press Enter to retry.'
        })
    } finally {
      clearTimeout(timer)
      if (requestRef.current === controller) requestRef.current = null
    }
  }
  const update = (changes, replace = false) => {
    resetSemantic()
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
        semanticEnabled={semanticEnabled}
        semanticStatus={current?.status}
        semanticMessage={current?.message}
        onSemanticSearch={searchSemantic}
        onTextSearch={resetSemantic}
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
          onClick={() => setPagination({ key: paginationKey, limit: limit + 50 })}
        >
          Load more
        </Button>
      ) : results.length > 0 ? (
        <p className="my-8 text-center text-sm text-gray-500">That's all for now. Come back later for more.</p>
      ) : current?.status === 'loading' ? null : (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <p className="font-medium">
            {current?.status === 'success' ? 'No close matches found.' : 'No bookmarks found.'}
          </p>
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
