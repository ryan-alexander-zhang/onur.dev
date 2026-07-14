import 'server-only'

import { cacheLife } from 'next/cache'

import { getGithubProfile } from '@/lib/github'

const DEFAULT_SITE_URL = 'https://www.lingomark.app'

export const OG_IMAGE = {
  width: 1200,
  height: 630,
  type: 'image/png'
}

function normalizeSiteBaseUrl(url) {
  const parsedUrl = new URL(url || DEFAULT_SITE_URL)

  parsedUrl.hash = ''
  parsedUrl.search = ''

  if (!parsedUrl.pathname.endsWith('/')) {
    parsedUrl.pathname = `${parsedUrl.pathname}/`
  }

  return parsedUrl.toString()
}

function trimTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function getSiteLabel(siteBaseUrl) {
  const { host, pathname } = new URL(siteBaseUrl)
  const normalizedPathname = pathname.replace(/\/$/, '')

  return normalizedPathname && normalizedPathname !== '/' ? `${host}${normalizedPathname}` : host
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

export function buildAbsoluteUrl(siteBaseUrl, path = '') {
  if (!path) return trimTrailingSlash(normalizeSiteBaseUrl(siteBaseUrl))

  return new URL(path.replace(/^\/+/, ''), normalizeSiteBaseUrl(siteBaseUrl)).toString()
}

export async function getSiteMetadata() {
  'use cache'
  cacheLife('hours')

  const profile = await getGithubProfile()
  const siteBaseUrl = normalizeSiteBaseUrl(DEFAULT_SITE_URL)
  const siteUrl = buildAbsoluteUrl(siteBaseUrl)
  const title = profile.name || 'Personal Website'
  const description = profile.bio || 'Personal website'
  const siteLabel = getSiteLabel(siteBaseUrl)
  const twitterHandle = profile.twitterUsername ? `@${profile.twitterUsername}` : ''

  return {
    ...profile,
    title,
    description,
    siteBaseUrl,
    siteUrl,
    siteOrigin: new URL(siteBaseUrl).origin,
    siteLabel,
    twitterHandle,
    author: {
      name: title,
      link: siteUrl
    },
    keywords: unique([title, description, siteLabel, twitterHandle])
  }
}
