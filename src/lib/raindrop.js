import 'server-only'

function getRaindropCollectionIds() {
  const rawCollectionIds = process.env.RAINDROP_COLLECTION_IDS
  if (!rawCollectionIds) return []

  try {
    const parsedCollectionIds = JSON.parse(rawCollectionIds)
    if (!Array.isArray(parsedCollectionIds)) {
      throw new Error('RAINDROP_COLLECTION_IDS must be a JSON array')
    }

    const normalizedCollectionIds = parsedCollectionIds.map((id) => Number(id))
    if (normalizedCollectionIds.some((id) => !Number.isInteger(id))) {
      throw new Error('RAINDROP_COLLECTION_IDS must contain only integers')
    }

    return [...new Set(normalizedCollectionIds)]
  } catch (error) {
    console.error(`Invalid RAINDROP_COLLECTION_IDS: ${error.message}`)
    return []
  }
}

const RAINDROP_COLLECTION_IDS = getRaindropCollectionIds()

const options = {
  cache: 'force-cache',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_RAINDROP_ACCESS_TOKEN}`
  },
  next: {
    revalidate: 60 * 60 * 24 * 7 // 7 days
  },
  signal: AbortSignal.timeout(10000) // 10 second timeout to prevent hanging requests
}

const RAINDROP_API_URL = 'https://api.raindrop.io/rest/v1'

export const getBookmarkItems = async (id, pageIndex = 0) => {
  if (!id) throw new Error('Bookmark ID is required')
  if (typeof pageIndex !== 'number' || pageIndex < 0) {
    throw new Error('Invalid page index')
  }

  try {
    const response = await fetch(
      `${RAINDROP_API_URL}/raindrops/${id}?` +
        new URLSearchParams({
          page: pageIndex,
          perpage: 50
        }),
      options
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch bookmark items: ${error.message}`)
    return null
  }
}

export const getBookmarks = async () => {
  try {
    const response = await fetch(`${RAINDROP_API_URL}/collections`, options)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const bookmarks = await response.json()
    return bookmarks.items.filter((bookmark) => RAINDROP_COLLECTION_IDS.includes(bookmark._id))
  } catch (error) {
    console.error(`Failed to fetch bookmarks: ${error.message}`)
    return null
  }
}

export const getBookmark = async (id) => {
  try {
    const response = await fetch(`${RAINDROP_API_URL}/collection/${id}`, options)
    return await response.json()
  } catch (error) {
    console.info(error)
    return null
  }
}
