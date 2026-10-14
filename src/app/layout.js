import '@/globals.css'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { draftMode } from 'next/headers'
import Script from 'next/script'
import { Suspense } from 'react'
import { LuEye as EyeIcon } from 'react-icons/lu'

import { GithubProfileProvider } from '@/components/github-profile-provider'
import { MenuContent } from '@/components/menu-content'
import { SideMenu } from '@/components/side-menu'
import { TailwindIndicator } from '@/components/tailwind-indicator'
import { getGithubProfile } from '@/lib/github'
import { getSiteMetadata } from '@/lib/site'

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
          <SiteShell>{children}</SiteShell>
        </Suspense>
      </body>
    </html>
  )
}

async function SiteShell({ children }) {
  const githubProfile = await getGithubProfile()
  return (
    <GithubProfileProvider profile={githubProfile}>
      <main vaul-drawer-wrapper="" className="min-h-screen bg-white">
        <Suspense fallback={null}>
          <DraftModeIndicator />
        </Suspense>
        <div className="lg:flex">
          <Suspense fallback={<div className="hidden bg-zinc-50 lg:block lg:w-60 lg:shrink-0 lg:border-r xl:w-72" />}>
            <SideMenu>
              <MenuContent />
            </SideMenu>
          </Suspense>
          <div className="flex flex-1">{children}</div>
        </div>
      </main>
      <TailwindIndicator />
      <Script
        src="https://unpkg.com/@tinybirdco/flock.js"
        data-datasource="analytics_events"
        data-host={process.env.NEXT_PUBLIC_TINYBIRD_URL}
        data-stringify-payload="true"
        data-token={process.env.NEXT_PUBLIC_TINYBIRD_TOKEN}
        strategy="afterInteractive"
      />
    </GithubProfileProvider>
  )
}

async function DraftModeIndicator() {
  if (!(await draftMode()).isEnabled) return null
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex h-12 w-full items-center justify-center bg-green-500 text-center text-sm font-medium text-white">
      <div className="flex items-center gap-2">
        <EyeIcon size={16} />
        <span>Draft mode is enabled</span>
      </div>
    </div>
  )
}

export async function generateMetadata() {
  const { title, description, keywords, siteUrl, twitterHandle } = await getSiteMetadata()
  const iconVersion = '20260613-r1'

  return {
    metadataBase: new URL(siteUrl),
    icons: {
      icon: [
        { url: `/favicon.ico?v=${iconVersion}`, sizes: 'any' },
        { url: `/icon.png?v=${iconVersion}`, type: 'image/png', sizes: '512x512' }
      ],
      shortcut: [{ url: `/favicon.ico?v=${iconVersion}` }],
      apple: [{ url: `/apple-icon.png?v=${iconVersion}`, sizes: '180x180', type: 'image/png' }]
    },
    robots: {
      index: true,
      follow: true
    },
    title: {
      default: title,
      template: `%s — ${title}`
    },
    description,
    keywords,
    openGraph: {
      title: {
        default: title,
        template: `%s — ${title}`
      },
      description,
      type: 'website',
      url: siteUrl,
      siteName: title
    },
    alternates: {
      canonical: siteUrl
    },
    twitter: {
      card: 'summary_large_image',
      ...(twitterHandle && {
        site: twitterHandle,
        creator: twitterHandle
      })
    },
    other: {
      pinterest: 'nopin'
    }
  }
}

export const viewport = {
  themeColor: 'white',
  colorScheme: 'only light',
  width: 'device-width',
  initialScale: 1
}
