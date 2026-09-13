import { revalidatePath, revalidateTag } from 'next/cache'

import { CONTENT_TYPES } from '@/lib/constants'
import { JOURNAL_CACHE_TAG } from '@/lib/journal-data'
import { PERMANENT_NOTES_CACHE_TAG } from '@/lib/permanent-notes-data'

const secret = process.env.NEXT_REVALIDATE_SECRET
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-revalidate-secret',
  'Access-Control-Max-Age': '86400'
}

function buildCorsHeaders(request) {
  const requestHeaders = new Headers(request.headers)
  const headers = new Headers(CORS_HEADERS)

  if (requestHeaders.get('access-control-request-private-network') === 'true') {
    headers.set('Access-Control-Allow-Private-Network', 'true')
  }

  return headers
}

function jsonWithCors(request, body, init = {}) {
  const headers = buildCorsHeaders(request)

  if (init.headers) {
    const extraHeaders = new Headers(init.headers)
    extraHeaders.forEach((value, key) => {
      headers.set(key, value)
    })
  }

  return Response.json(body, {
    ...init,
    headers
  })
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request)
  })
}

export async function POST(request) {
  const requestHeaders = new Headers(request.headers)
  const revalidateSecret = requestHeaders.get('x-revalidate-secret')
  if (!secret || revalidateSecret !== secret) {
    return jsonWithCors(
      request,
      {
        revalidated: false,
        now: Date.now(),
        message: 'Invalid secret'
      },
      { status: 401 }
    )
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonWithCors(request, { revalidated: false, message: 'Invalid JSON payload' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonWithCors(request, { revalidated: false, message: 'Invalid payload' }, { status: 400 })
  }

  const { contentTypeId, slug } = payload

  switch (contentTypeId) {
    case CONTENT_TYPES.PAGE:
      if (slug) {
        revalidatePath(`/${slug}`)
      } else {
        return jsonWithCors(
          request,
          {
            revalidated: false,
            now: Date.now(),
            message: 'Missing page slug to revalidate'
          },
          { status: 400 }
        )
      }
      break
    case CONTENT_TYPES.POST:
      if (slug) {
        revalidatePath(`/writing/${slug}`)
        revalidatePath('/writing')
        revalidatePath('/writing', 'layout')
      } else {
        return jsonWithCors(
          request,
          {
            revalidated: false,
            now: Date.now(),
            message: 'Missing writing slug to revalidate'
          },
          { status: 400 }
        )
      }
      break
    case CONTENT_TYPES.PERMANENT_NOTE:
      revalidateTag(PERMANENT_NOTES_CACHE_TAG, { expire: 0 })
      revalidatePath('/cards')
      revalidatePath('/cards', 'layout')
      revalidatePath('/sitemap.xml')
      break
    case CONTENT_TYPES.LOGBOOK:
      revalidatePath('/journey')
      break
    case CONTENT_TYPES.JOURNAL_ENTRY:
      revalidateTag(JOURNAL_CACHE_TAG, { expire: 0 })
      revalidatePath('/journey')
      revalidatePath('/journey', 'layout')
      break
    default:
      return jsonWithCors(
        request,
        {
          revalidated: false,
          now: Date.now(),
          message: 'Invalid content type'
        },
        { status: 400 }
      )
  }

  return jsonWithCors(request, { revalidated: true, now: Date.now() })
}
