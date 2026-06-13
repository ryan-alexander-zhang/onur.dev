import '@/globals.css'

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { cacheLife } from 'next/cache'
import { draftMode } from 'next/headers'
import Script from 'next/script'
import { LuEye as EyeIcon } from 'react-icons/lu'

import { GithubProfileProvider } from '@/components/github-profile-provider'
import { MenuContent } from '@/components/menu-content'
import { SideMenu } from '@/components/side-menu'
import { TailwindIndicator } from '@/components/tailwind-indicator'
import { preloadGetAllPosts } from '@/lib/contentful'
import { getGithubProfile } from '@/lib/github'
import { getSiteMetadata } from '@/lib/site'

export default async function RootLayout({ children }) {
  'use cache'

  cacheLife('max')
  const { isEnabled } = await draftMode()
  const githubProfile = await getGithubProfile()
  preloadGetAllPosts(isEnabled)

  return (
    <html
      lang="en"
      data-theme="light"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <GithubProfileProvider profile={githubProfile}>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <main vaul-drawer-wrapper="" className="min-h-screen bg-white">
            {isEnabled && (
              <div className="absolute inset-x-0 bottom-0 z-50 flex h-12 w-full items-center justify-center bg-green-500 text-center text-sm font-medium text-white">
                <div className="flex items-center gap-2">
                  <EyeIcon size={16} />
                  <span>Draft mode is enabled</span>
                </div>
              </div>
            )}
            <div className="lg:flex">
              <SideMenu>
                <MenuContent />
              </SideMenu>
              <div className="flex flex-1">{children}</div>
            </div>
          </main>
          <TailwindIndicator />
          <Script
            src="https://unpkg.com/@tinybirdco/flock.js"
            data-host={process.env.NEXT_PUBLIC_TINYBIRD_URL}
            data-token={process.env.NEXT_PUBLIC_TINYBIRD_TOKEN}
            strategy="lazyOnload"
          />
        </GithubProfileProvider>
      </body>
    </html>
  )
}

export async function generateMetadata() {
  const { title, description, keywords, siteUrl, twitterHandle } = await getSiteMetadata()

  return {
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
