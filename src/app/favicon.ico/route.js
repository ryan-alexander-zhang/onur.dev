import { NextResponse } from 'next/server'

function redirectToIcon(request) {
  return NextResponse.redirect(new URL('/icon', request.url))
}

export function GET(request) {
  return redirectToIcon(request)
}

export function HEAD(request) {
  return redirectToIcon(request)
}
