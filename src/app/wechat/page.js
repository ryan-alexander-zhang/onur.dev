import { cacheLife } from 'next/cache'

import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { ScrollArea } from '@/components/scroll-area'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

const QR_IMAGE_PATH = '/assets/wechat-official.jpg'

export default async function WechatPage() {
  'use cache'

  cacheLife('max')

  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader title="WeChat" />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle
            title="WeChat"
            subtitle={
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Scan the QR code with WeChat, or open this page in WeChat and long press the image to identify it.
              </p>
            }
          />
          <section className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <img
                  src={QR_IMAGE_PATH}
                  alt="WeChat official account QR code"
                  width={430}
                  height={430}
                  className="h-auto w-full"
                />
              </div>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-gray-600">
              <p>微信扫码关注公众号。</p>
              <p>电脑端请使用微信“扫一扫”，手机微信内打开时可以长按二维码识别。</p>
            </div>
          </section>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const { siteBaseUrl } = await getSiteMetadata()
  const title = 'WeChat'
  const description = 'Scan the QR code to follow the WeChat official account.'
  const siteUrl = buildAbsoluteUrl(siteBaseUrl, 'wechat')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: siteUrl
    },
    alternates: {
      canonical: siteUrl
    }
  }
}
