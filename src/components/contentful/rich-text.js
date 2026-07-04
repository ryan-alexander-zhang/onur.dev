import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import { BLOCKS, INLINES, MARKS } from '@contentful/rich-text-types'
import dynamic from 'next/dynamic'

import { Link } from '@/components/link'
import { ShowInView } from '@/components/show-in-view'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { createHeadingId, getRichTextPlainText } from '@/lib/contentful-rich-text'

const TweetCard = dynamic(() => import('@/components/tweet-card/tweet-card').then((mod) => mod.TweetCard))
const CodeBlock = dynamic(() => import('@/components/contentful/code-block').then((mod) => mod.CodeBlock))
const DynamicIframe = dynamic(() => import('@/components/contentful/iframe').then((mod) => mod.Iframe))
const EXTERNAL_IMAGE_SENTINEL = '\u200B'

function getExternalImageData(node) {
  const [sentinelNode, hyperlinkNode, ...remainingNodes] = node?.content ?? []

  if (sentinelNode?.nodeType !== 'text' || sentinelNode.value !== EXTERNAL_IMAGE_SENTINEL) {
    return null
  }

  if (hyperlinkNode?.nodeType !== INLINES.HYPERLINK) {
    return null
  }

  const hasTrailingContent = remainingNodes.some((childNode) => {
    if (childNode.nodeType !== 'text') {
      return true
    }

    return childNode.value.trim() !== ''
  })

  if (hasTrailingContent) {
    return null
  }

  const src = hyperlinkNode.data?.uri
  if (!src) {
    return null
  }

  const title = node.data?.externalImage?.title?.trim() || getRichTextPlainText(hyperlinkNode).trim()
  const description = node.data?.externalImage?.description?.trim() || ''

  return {
    alt: description || title,
    caption: description,
    title,
    src
  }
}

function options(links) {
  const findAsset = (id) => links?.assets.block.find((item) => item.sys.id === id)
  const findInlineEntry = (id) => links?.entries.inline.find((item) => item.sys.id === id)
  const headingIds = new Map()

  const renderHeading = (node, children, tagName) => {
    const headingId = createHeadingId(getRichTextPlainText(node).trim(), headingIds)
    const TagName = tagName

    return (
      <TagName
        id={headingId}
        className="group relative mt-6 mb-2 w-fit cursor-pointer before:absolute before:-left-4 hover:before:content-['#']"
      >
        <a href={`#${headingId}`} className="group-hover:underline group-hover:underline-offset-4">
          {children}
        </a>
      </TagName>
    )
  }

  return {
    renderMark: {
      [MARKS.BOLD]: (text) => <span className="font-semibold text-black">{text}</span>,
      [MARKS.ITALIC]: (text) => <span className="italic">{text}</span>,
      [MARKS.CODE]: (text) => <code className="inline-code">{text}</code>
    },
    renderNode: {
      [BLOCKS.HEADING_2]: (node, children) => renderHeading(node, children, 'h2'),
      [BLOCKS.HEADING_3]: (node, children) => renderHeading(node, children, 'h3'),
      // Must be a <div> instead of <p> to avoid descendant issue, hence to avoid mismatching UI between server and client on hydration.
      [BLOCKS.PARAGRAPH]: (node, children) => {
        const externalImage = getExternalImageData(node)
        if (externalImage) {
          return <ZoomableImage {...externalImage} />
        }

        return <div className="mb-4 leading-[1.75] last:mb-0 [&:has(+ul)]:mb-1">{children}</div>
      },
      [BLOCKS.UL_LIST]: (_, children) => <ul className="mb-4 flex list-disc flex-col gap-0.5 pl-6">{children}</ul>,
      [BLOCKS.OL_LIST]: (_, children) => (
        <ol className="mb-4 flex list-inside list-[decimal-leading-zero] flex-col gap-2">{children}</ol>
      ),
      [BLOCKS.LIST_ITEM]: (_, children) => <li>{children}</li>,
      [BLOCKS.QUOTE]: (_, children) => (
        <blockquote className="mb-4 rounded-r-lg border-l-2 border-gray-200 px-4 font-medium text-gray-500">
          {children}
        </blockquote>
      ),
      [BLOCKS.TABLE]: (node, children) => {
        const headerRows = []
        const bodyRows = []

        children.forEach((child, index) => {
          const row = node.content[index]
          const isHeaderRow = row?.content?.every((cell) => cell.nodeType === BLOCKS.TABLE_HEADER_CELL)

          if (isHeaderRow && bodyRows.length === 0) {
            headerRows.push(child)
            return
          }

          bodyRows.push(child)
        })

        return (
          <div className="mb-6">
            <Table>
              {headerRows.length > 0 && <TableHeader>{headerRows}</TableHeader>}
              {bodyRows.length > 0 && <TableBody>{bodyRows}</TableBody>}
            </Table>
          </div>
        )
      },
      [BLOCKS.TABLE_ROW]: (_, children) => <TableRow>{children}</TableRow>,
      [BLOCKS.TABLE_HEADER_CELL]: (_, children) => <TableHead className="[&>div]:mb-0">{children}</TableHead>,
      [BLOCKS.TABLE_CELL]: (_, children) => <TableCell className="[&>div]:mb-0">{children}</TableCell>,
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const asset = findAsset(node.data.target.sys.id)
        if (!asset) return null
        const isEagerLoading = asset.contentfulMetadata?.tags?.some((tag) => tag.name === 'Eager Loading')

        return (
          <ZoomableImage
            alt={asset.description || asset.title}
            caption={asset.description}
            height={asset.height}
            loading={isEagerLoading ? 'eager' : 'lazy'}
            src={asset.url}
            title={asset.title}
            width={asset.width}
          />
        )
      },
      [BLOCKS.HR]: () => <hr className="my-12" />,
      [INLINES.HYPERLINK]: (node, children) => <Link href={node.data.uri}>{children}</Link>,
      [INLINES.EMBEDDED_ENTRY]: async (node) => {
        const entry = findInlineEntry(node.data.target.sys.id)

        switch (entry.__typename) {
          case 'ContentEmbed': {
            const { embedUrl, title, type } = entry

            switch (type) {
              case 'Video': {
                const YouTubeEmbed = await import('@next/third-parties/google').then((mod) => mod.YouTubeEmbed)
                const videoId = embedUrl.split('/embed/')[1]

                return (
                  <ShowInView>
                    <YouTubeEmbed
                      videoid={videoId}
                      playlabel={title}
                      params="fs=0;controls=0&mute=1"
                      className="aspect-video"
                    />
                    {title && <div className="py-2 text-center text-xs font-light text-gray-500">{title}</div>}
                  </ShowInView>
                )
              }
              case 'SoundCloud': {
                return <DynamicIframe embedUrl={embedUrl} title={title} scrolling="no" className="h-[166px]" />
              }
              default:
                return null
            }
          }
          case 'CodeBlock': {
            return <CodeBlock {...entry} />
          }
          case 'Tweet': {
            const { id } = entry
            return <TweetCard id={id} />
          }
          case 'Carousel': {
            const Carousel = await import('@/components/contentful/carousel').then((mod) => mod.Carousel)
            return <Carousel images={entry.imagesCollection?.items} />
          }
          default:
            return null
        }
      }
    }
  }
}

export const RichText = ({ content }) => {
  if (!content) return null
  return documentToReactComponents(content.json, options(content.links))
}
