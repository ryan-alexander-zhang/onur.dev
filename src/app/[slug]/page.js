import { cacheLife } from 'next/cache'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ContentLayoutWithToc } from '@/components/contentful/content-layout-with-toc'
import { RichText } from '@/components/contentful/rich-text'
import { MobileTableOfContents } from '@/components/contentful/table-of-contents'
import { FloatingHeader } from '@/components/floating-header'
import { GradientBg } from '@/components/gradient-bg'
import { PageTitle } from '@/components/page-title'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getAllPageSlugs, getPage, getPageSeo } from '@/lib/contentful'
import { extractRichTextHeadings } from '@/lib/contentful-rich-text'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { isDevelopment } from '@/lib/utils'

export async function generateStaticParams() {
  const allPages = await getAllPageSlugs()

  return allPages
    .filter((page) => !page.hasCustomPage) // filter out pages that have custom pages, e.g. /journey
    .map((page) => ({
      slug: page.slug
    }))
}

async function fetchData(slug) {
  'use cache'
  cacheLife('max')

  const { isEnabled } = await draftMode()
  const page = await getPage(slug, isDevelopment || isEnabled)
  if (!page) notFound()
  return { page }
}

export default async function PageSlug(props) {
  'use cache'

  cacheLife('max')
  const params = await props.params
  const { slug } = params
  const {
    page: { title, content }
  } = await fetchData(slug)
  const headings = extractRichTextHeadings(content?.json)

  return (
    <ScrollArea useScrollAreaId>
      <GradientBg />
      <FloatingHeader scrollTitle={title}>
        <MobileTableOfContents headings={headings} />
      </FloatingHeader>
      <div className="content-wrapper">
        <ContentLayoutWithToc headings={headings}>
          <>
            <PageTitle title={title} />
            <Suspense fallback={<ScreenLoadingSpinner />}>
              <RichText content={content} />
            </Suspense>
          </>
        </ContentLayoutWithToc>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata(props) {
  const params = await props.params
  const { slug } = params
  const [{ siteBaseUrl }, seoData] = await Promise.all([getSiteMetadata(), getPageSeo(slug)])
  if (!seoData) return null

  const {
    seo: { title, description, keywords }
  } = seoData
  const siteUrl = buildAbsoluteUrl(siteBaseUrl, slug)

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      url: siteUrl,
      images: `${siteUrl}/og.png`
    },
    alternates: {
      canonical: siteUrl
    }
  }
}
