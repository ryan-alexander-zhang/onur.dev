import { NextResponse } from 'next/server'

export default function proxy(request, event) {
  const { pathname } = request.nextUrl
  const pathSegments = pathname.split('/').filter(Boolean)
  const writingSlug = pathSegments[0] === 'writing' && pathSegments.length === 2 ? pathSegments[1] : null

  async function sendAnalytics() {
    const analyticsUrl = new URL('/api/increment-views', request.nextUrl.origin)
    analyticsUrl.searchParams.set('slug', writingSlug)

    try {
      const res = await fetch(analyticsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      })

      if (res.status !== 200) console.error('Failed to send analytics', res)
    } catch (error) {
      console.error('Error sending analytics', error)
    }
  }

  /**
   * The `event.waitUntil` function is the real magic here.
   * It enables the response to proceed without waiting for the completion of `sendAnalytics()`.
   * This ensures that the user experience remains uninterrupted and free from unnecessary delays.
   */
  if (writingSlug) event.waitUntil(sendAnalytics())
  return NextResponse.next()
}

export const config = {
  matcher: [
    {
      source: '/writing/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
