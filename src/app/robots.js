import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

export default async function robots() {
  const { siteBaseUrl, siteOrigin } = await getSiteMetadata()

  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    sitemap: buildAbsoluteUrl(siteBaseUrl, 'sitemap.xml'),
    host: siteOrigin
  }
}
