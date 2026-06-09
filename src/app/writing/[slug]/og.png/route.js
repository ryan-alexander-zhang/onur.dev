import { ImageResponse } from 'next/og'

import { OpenGraphImage } from '@/components/og-image'
import { getAllPostSlugs, getWritingSeo } from '@/lib/contentful'
import { getBoldFont, getRegularFont } from '@/lib/fonts'
import { getSiteMetadata, OG_IMAGE } from '@/lib/site'

export const size = {
  width: OG_IMAGE.width,
  height: OG_IMAGE.height
}

export async function generateStaticParams() {
  const allPosts = await getAllPostSlugs()
  return allPosts.map((post) => ({ slug: post.slug }))
}

export async function GET(_, props) {
  const params = await props.params
  const { slug } = params
  const [{ author, siteLabel }, seoData, regularFontData, boldFontData] = await Promise.all([
    getSiteMetadata(),
    getWritingSeo(slug),
    getRegularFont(),
    getBoldFont()
  ])
  if (!seoData) return null
  const {
    seo: { title, ogImageTitle, ogImageSubtitle }
  } = seoData

  return new ImageResponse(
    (
      <OpenGraphImage
        title={ogImageTitle || title}
        description={ogImageSubtitle || `by ${author.name}`}
        siteLabel={siteLabel}
        url="writing"
      />
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Geist Sans',
          data: regularFontData,
          style: 'normal',
          weight: 400
        },
        {
          name: 'Geist Sans',
          data: boldFontData,
          style: 'normal',
          weight: 500
        }
      ]
    }
  )
}
