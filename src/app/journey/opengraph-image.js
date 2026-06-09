import { ImageResponse } from 'next/og'

import { OpenGraphImage } from '@/components/og-image'
import { getPageSeo } from '@/lib/contentful'
import { getBoldFont, getRegularFont } from '@/lib/fonts'
import { getSiteMetadata, OG_IMAGE } from '@/lib/site'

export const alt = 'Journey'
export const size = {
  width: OG_IMAGE.width,
  height: OG_IMAGE.height
}
export const contentType = OG_IMAGE.type

export default async function Image() {
  const [{ siteLabel }, seoData = {}, regularFontData, boldFontData] = await Promise.all([
    getSiteMetadata(),
    getPageSeo('journey'),
    getRegularFont(),
    getBoldFont()
  ])
  const { seo: { title, description, ogImageTitle, ogImageSubtitle } = {} } = seoData

  return new ImageResponse(
    (
      <OpenGraphImage
        title={ogImageTitle || title}
        description={ogImageSubtitle || description}
        siteLabel={siteLabel}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
        }
        url="journey"
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
