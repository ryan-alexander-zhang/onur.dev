import { BLOCKS } from '@contentful/rich-text-types'

import { dasherize } from '@/lib/utils'

const HEADING_NODE_TYPES = new Set([BLOCKS.HEADING_2, BLOCKS.HEADING_3])

export function extractRichTextHeadings(document) {
  if (!document?.content) {
    return []
  }

  const headingIds = new Map()
  const headings = []

  walkRichTextNodes(document.content, (node) => {
    if (!HEADING_NODE_TYPES.has(node.nodeType)) {
      return
    }

    const text = getRichTextPlainText(node).trim()
    if (!text) {
      return
    }

    headings.push({
      id: createHeadingId(text, headingIds),
      level: node.nodeType === BLOCKS.HEADING_2 ? 2 : 3,
      text
    })
  })

  return headings
}

export function getRichTextPlainText(node) {
  if (!node) {
    return ''
  }

  if (Array.isArray(node)) {
    return node.map(getRichTextPlainText).join('')
  }

  if (node.nodeType === 'text') {
    return node.value || ''
  }

  if (!Array.isArray(node.content)) {
    return ''
  }

  return node.content.map(getRichTextPlainText).join('')
}

export function createHeadingId(text, headingIds = new Map()) {
  const baseId = normalizeHeadingId(text)
  const seenCount = headingIds.get(baseId) || 0

  headingIds.set(baseId, seenCount + 1)
  return seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`
}

function normalizeHeadingId(text) {
  const normalized = dasherize(text)
    .trim()
    .replace(/^-+|-+$/g, '')
  return normalized || 'section'
}

function walkRichTextNodes(nodes, visit) {
  for (const node of nodes) {
    visit(node)

    if (Array.isArray(node.content) && node.content.length > 0) {
      walkRichTextNodes(node.content, visit)
    }
  }
}
