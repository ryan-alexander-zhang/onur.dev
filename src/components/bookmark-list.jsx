'use client'

import { useCallback, useMemo, useState } from 'react'
import { LuArrowDown as ArrowDownIcon } from 'react-icons/lu'

import { getBookmarkItemsByPageIndex } from '@/app/actions'
import { BookmarkCard } from '@/components/bookmark-card'
import { Button } from '@/components/ui/button'

export const BookmarkList = ({ initialData, id }) => {
  const [data, setData] = useState(initialData?.result ? initialData?.items : [])
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(initialData?.count ?? 0)

  const loadMore = async () => {
    if (isReachingEnd || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      const newData = await getBookmarkItemsByPageIndex(id, pageIndex + 1)
      if (!newData?.result) throw new Error('No bookmark data')
      setData((previous) => [...new Map([...previous, ...newData.items].map((item) => [item._id, item])).values()])
      setCount(newData.count)
      setPageIndex((page) => page + 1)
    } catch {
      setError('Could not load bookmarks. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getChunks = useCallback(() => {
    const firstChunk = []
    const lastChunk = []
    data.forEach((element, index) => {
      if (index % 2 === 0) {
        firstChunk.push(element)
      } else {
        lastChunk.push(element)
      }
    })
    return [[...firstChunk], [...lastChunk]]
  }, [data])

  const chunks = useMemo(() => getChunks(), [getChunks])
  const isReachingEnd = data.length >= count || (pageIndex + 1) * 50 >= count

  const memoizedBookmarks = useMemo(() => {
    return data.map((bookmark, bookmarkIndex) => (
      <div key={bookmark._id} className="grid place-content-start gap-4">
        <BookmarkCard key={bookmark._id} bookmark={bookmark} order={bookmarkIndex} />
      </div>
    ))
  }, [data])

  const memoizedChunks = useMemo(() => {
    return chunks.map((chunk, chunkIndex) => (
      <div key={`chunk_${chunkIndex}`} className="grid place-content-start gap-4">
        {chunk.map((bookmark, bookmarkIndex) => (
          <BookmarkCard key={bookmark._id} bookmark={bookmark} order={bookmarkIndex} />
        ))}
      </div>
    ))
  }, [chunks])

  return (
    <div>
      <div className="flex flex-col gap-4 @lg:hidden">{memoizedBookmarks}</div>
      <div className="hidden @lg:grid @lg:grid-cols-2 @lg:gap-4">{memoizedChunks}</div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {data.length > 0 ? (
        <div className="mt-8 flex min-h-16 items-center justify-center text-sm lg:mt-12">
          {!isReachingEnd ? (
            <>
              {isLoading ? (
                <div
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent text-black"
                  role="status"
                  aria-label="loading"
                >
                  <span className="sr-only">Loading...</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full justify-center bg-white"
                >
                  Load more
                  <ArrowDownIcon size={16} />
                </Button>
              )}
            </>
          ) : (
            <span>That's all for now. Come back later for more.</span>
          )}
        </div>
      ) : (
        <div className="mt-8 flex min-h-16 flex-col items-center justify-center lg:mt-12">
          <span>No bookmarks found.</span>
        </div>
      )}
    </div>
  )
}
