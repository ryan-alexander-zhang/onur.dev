import Markdown from 'markdown-to-jsx'

import { Link } from '@/components/link'
import { TweetCard } from '@/components/tweet-card/tweet-card'

const resolveMarkdownUrl = (url, baseUrl) => {
  if (!url) return url
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z]+:/i.test(url) || url.startsWith('#')) return url
  if (!baseUrl) return url

  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return url
  }
}

export const MarkdownRenderer = ({ imageBaseUrl, linkBaseUrl, options, ...rest }) => {
  const defaultOverrides = {
    a: ({ className, href, ...anchorProps }) => <Link href={resolveMarkdownUrl(href, linkBaseUrl)} {...anchorProps} />,
    p: ({ children }) => <p className="mb-2 text-sm">{children}</p>,
    img: ({ alt, src }) => (
      <span className="mt-2 block overflow-hidden rounded-xl border">
        <img
          alt={alt}
          src={resolveMarkdownUrl(src, imageBaseUrl ?? linkBaseUrl)}
          width={400}
          height={300}
          loading="lazy"
          className="animate-reveal aspect-auto w-full object-cover"
          nopin="nopin"
        />
      </span>
    ),
    tweet: ({ id }) => <TweetCard id={id} className="mt-2" />
  }

  return (
    <Markdown
      options={{
        ...options,
        overrides: {
          ...defaultOverrides,
          ...options?.overrides
        }
      }}
      {...rest}
    />
  )
}
