import { cacheLife } from 'next/cache'
import NextLink from 'next/link'
import { Suspense } from 'react'

import { FloatingHeader } from '@/components/floating-header'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { PageTitle } from '@/components/page-title'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { Button } from '@/components/ui/button'
import { WritingList } from '@/components/writing-list'
import { getAllPosts } from '@/lib/contentful'
import { getGithubProfile, getHomeProfileReadme } from '@/lib/github'
import { getItemsByYear, getSortedPosts } from '@/lib/utils'

async function fetchData() {
  'use cache'
  cacheLife('hours')

  const [allPosts, profileReadme, githubProfile] = await Promise.all([
    getAllPosts(),
    getHomeProfileReadme(),
    getGithubProfile()
  ])
  const sortedPosts = getSortedPosts(allPosts)
  const items = getItemsByYear(sortedPosts)
  return { items, profileReadme, githubProfile }
}

export default async function Home() {
  const { items, profileReadme, githubProfile } = await fetchData()

  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader scrollTitle={githubProfile.name} />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title="Home" className="lg:hidden" />
          <MarkdownRenderer
            imageBaseUrl={profileReadme.imageBaseUrl}
            linkBaseUrl={profileReadme.linkBaseUrl}
            options={{
              overrides: {
                h1: ({ children }) => <h2 className="mb-3 text-2xl text-balance md:text-3xl">{children}</h2>,
                h3: ({ children }) => <p className="mb-4 text-base text-gray-500">{children}</p>,
                p: ({ children }) => <p>{children}</p>,
                ul: ({ children }) => <ul className="mb-6 flex list-disc flex-col gap-1.5 pl-6">{children}</ul>,
                li: ({ children }) => <li className="pl-0">{children}</li>
              }
            }}
          >
            {profileReadme.markdown}
          </MarkdownRenderer>
          <Button asChild variant="link" className="inline px-0">
            <NextLink href="/writing">
              <h2 className="mt-8 mb-4">Writing</h2>
            </NextLink>
          </Button>
          <Suspense fallback={<ScreenLoadingSpinner />}>
            <WritingList items={items} header="Writing" />
          </Suspense>
        </div>
      </div>
    </ScrollArea>
  )
}
