const crypto = require('crypto')
const path = require('path')

const DEFAULT_CMA_BASE_URL = 'https://api.contentful.com'
const DEFAULT_UPLOAD_BASE_URL = 'https://upload.contentful.com'
const DEFAULT_LOCALE = 'en-US'
const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/

const CONTENT_TYPES = {
  PAGE: 'page',
  POST: 'post',
  LOGBOOK: 'logbook',
  SEO: 'seo',
  CONTENT_EMBED: 'contentEmbed',
  CODE_BLOCK: 'codeBlock',
  TWEET: 'tweet',
  CAROUSEL: 'carousel'
}

const CONTENT_TYPE_ALIASES = {
  article: CONTENT_TYPES.POST,
  journal: CONTENT_TYPES.LOGBOOK,
  journey: CONTENT_TYPES.LOGBOOK,
  logbook: CONTENT_TYPES.LOGBOOK,
  page: CONTENT_TYPES.PAGE,
  post: CONTENT_TYPES.POST,
  writing: CONTENT_TYPES.POST
}

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf'
}

module.exports = {
  createQuickAddModule
}

function createQuickAddModule(mode) {
  const normalizedMode = normalizeMode(mode)

  return {
    entry: async (params, settings) => {
      return syncCurrentNote(params, settings, normalizedMode)
    },
    settings: {
      name: normalizedMode === 'publish' ? 'Contentful Publish Current Note' : 'Contentful Sync Current Note (Preview)',
      author: 'Codex',
      options: {
        cmaBaseUrl: {
          type: 'text',
          defaultValue: DEFAULT_CMA_BASE_URL,
          placeholder: DEFAULT_CMA_BASE_URL,
          name: 'CMA Base URL',
          description: 'Contentful Content Management API base URL. Supports env:YOUR_ENV_KEY.'
        },
        uploadBaseUrl: {
          type: 'text',
          defaultValue: DEFAULT_UPLOAD_BASE_URL,
          placeholder: DEFAULT_UPLOAD_BASE_URL,
          name: 'Upload Base URL',
          description: 'Contentful Upload API base URL. Supports env:YOUR_ENV_KEY.'
        },
        spaceId: {
          type: 'text',
          defaultValue: '',
          placeholder: 'your_space_id',
          name: 'Space ID',
          description: 'Contentful space ID. Supports env:YOUR_ENV_KEY.'
        },
        environmentId: {
          type: 'text',
          defaultValue: 'master',
          placeholder: 'master',
          name: 'Environment ID',
          description: 'Contentful environment ID. Supports env:YOUR_ENV_KEY.'
        },
        managementToken: {
          type: 'text',
          defaultValue: '',
          placeholder: 'env:CONTENTFUL_MANAGEMENT_TOKEN',
          name: 'Management Token',
          description: 'Contentful personal access token or management token. Supports env:YOUR_ENV_KEY.'
        },
        locale: {
          type: 'text',
          defaultValue: DEFAULT_LOCALE,
          placeholder: DEFAULT_LOCALE,
          name: 'Locale',
          description: 'Locale to write Contentful fields into. Supports env:YOUR_ENV_KEY.'
        },
        revalidateUrl: {
          type: 'text',
          defaultValue: '',
          placeholder: 'https://your-site.com/api/revalidate',
          name: 'Revalidate URL',
          description: 'Optional on-demand revalidate endpoint. Supports env:YOUR_ENV_KEY.'
        },
        revalidateSecret: {
          type: 'text',
          defaultValue: '',
          placeholder: 'env:NEXT_REVALIDATE_SECRET',
          name: 'Revalidate Secret',
          description: 'Optional x-revalidate-secret header value. Supports env:YOUR_ENV_KEY.'
        },
        showNotice: {
          type: 'toggle',
          defaultValue: true,
          name: 'Show Notice',
          description: 'Show Obsidian notices for success or failure.'
        }
      }
    }
  }
}

async function syncCurrentNote(params, settings, mode) {
  const { app, obsidian } = params
  const fallbackShowNotice = settings.showNotice !== false

  try {
    const config = readSettings(settings)
    const activeFile = app.workspace.getActiveFile()
    if (!activeFile) {
      throw new Error('No active file found')
    }

    if (activeFile.extension !== 'md') {
      throw new Error('Active file must be a Markdown file')
    }

    const rawMarkdown = normalizeLineEndings(await app.vault.read(activeFile))
    const frontmatter = sanitizeFrontmatter(readFrontmatter(app, activeFile))
    const note = normalizeNote(activeFile, rawMarkdown, frontmatter, config.locale)
    const client = createContentfulClient(config)
    const context = {
      app,
      client,
      config,
      file: activeFile,
      frontmatter,
      mode,
      note,
      obsidian,
      counters: {
        asset: 0,
        codeBlock: 0,
        embed: 0
      }
    }

    const syncResult = await syncNoteToContentful(context)
    const nextFrontmatter = buildUpdatedFrontmatter(frontmatter, syncResult.frontmatterUpdates)
    await writeFrontmatter(app, obsidian, activeFile, rawMarkdown, nextFrontmatter)

    let revalidated = false
    if (mode === 'publish' && config.revalidateUrl) {
      revalidated = await triggerRevalidation(config, note)
    }

    const summary = [
      `${mode === 'publish' ? 'Published' : 'Synced draft'} ${activeFile.basename}`,
      `type=${note.contentType}`,
      `entryId=${syncResult.entry.sys.id}`,
      revalidated ? 'revalidated=yes' : 'revalidated=no'
    ].join(' | ')

    if (config.showNotice) {
      new obsidian.Notice(summary, 9000)
    }

    return {
      entryId: syncResult.entry.sys.id,
      seoEntryId: syncResult.seoEntry?.sys?.id ?? null,
      mode,
      revalidated,
      file: activeFile.path,
      summary
    }
  } catch (error) {
    if (fallbackShowNotice) {
      new obsidian.Notice(`Contentful sync failed: ${error.message}`, 12000)
    }

    throw error
  }
}

async function syncNoteToContentful(context) {
  switch (context.note.contentType) {
    case CONTENT_TYPES.POST:
    case CONTENT_TYPES.PAGE:
      return syncRichContentNote(context)
    case CONTENT_TYPES.LOGBOOK:
      return syncLogbookNote(context)
    default:
      throw new Error(`Unsupported content type: ${context.note.contentType}`)
  }
}

async function syncRichContentNote(context) {
  const seoEntry = await upsertSeoEntry(context)
  const contentDocument = await markdownToRichText(context.note.bodyMarkdown, context)

  const fields = {
    title: localize(context.note.title, context.note.locale),
    slug: localize(context.note.slug, context.note.locale),
    seo: localize(linkObject('Entry', seoEntry.sys.id), context.note.locale),
    content: localize(contentDocument, context.note.locale)
  }

  if (context.note.contentType === CONTENT_TYPES.POST && context.note.date) {
    fields.date = localize(context.note.date, context.note.locale)
  }

  if (context.note.contentType === CONTENT_TYPES.PAGE && typeof context.note.hasCustomPage === 'boolean') {
    fields.hasCustomPage = localize(context.note.hasCustomPage, context.note.locale)
  }

  const entry = await upsertEntry(context.client, context.note.entryId, context.note.contentType, fields)

  if (context.mode === 'publish') {
    await publishEntry(context.client, entry.sys.id)
  }

  return {
    entry: await getEntry(context.client, entry.sys.id),
    seoEntry,
    frontmatterUpdates: {
      contentful_content_type: context.note.contentType,
      contentful_entry_id: entry.sys.id,
      contentful_seo_entry_id: seoEntry.sys.id,
      contentful_locale: context.note.locale,
      date: context.note.date,
      contentful_last_mode: context.mode === 'publish' ? 'published' : 'preview',
      contentful_last_synced_at: new Date().toISOString(),
      contentful_last_published_at:
        context.mode === 'publish'
          ? new Date().toISOString()
          : (context.frontmatter.contentful_last_published_at ?? ''),
      slug: context.note.slug
    }
  }
}

async function syncLogbookNote(context) {
  const imageSources = readStringArray(context.frontmatter.images).concat(
    extractBlockImageSources(context.note.bodyMarkdown)
  )

  const imageLinks = []
  for (const source of uniqueValues(imageSources)) {
    const asset = await upsertAssetFromSource(context, {
      source,
      title: context.note.title,
      description: context.note.description
    })

    imageLinks.push(linkObject('Asset', asset.sys.id))
  }

  const fields = {
    title: localize(context.note.title, context.note.locale),
    date: localize(context.note.date, context.note.locale),
    description: localize(context.note.description, context.note.locale)
  }

  if (imageLinks.length > 0) {
    fields.images = localize(imageLinks, context.note.locale)
  }

  const entry = await upsertEntry(context.client, context.note.entryId, context.note.contentType, fields)

  if (context.mode === 'publish') {
    await publishEntry(context.client, entry.sys.id)
  }

  return {
    entry: await getEntry(context.client, entry.sys.id),
    seoEntry: null,
    frontmatterUpdates: {
      contentful_content_type: context.note.contentType,
      contentful_entry_id: entry.sys.id,
      contentful_locale: context.note.locale,
      date: context.note.date,
      contentful_last_mode: context.mode === 'publish' ? 'published' : 'preview',
      contentful_last_synced_at: new Date().toISOString(),
      contentful_last_published_at:
        context.mode === 'publish' ? new Date().toISOString() : (context.frontmatter.contentful_last_published_at ?? '')
    }
  }
}

async function upsertSeoEntry(context) {
  const fields = {
    title: localize(context.note.seo.title, context.note.locale),
    description: localize(context.note.seo.description, context.note.locale)
  }

  if (context.note.seo.ogImageTitle) {
    fields.ogImageTitle = localize(context.note.seo.ogImageTitle, context.note.locale)
  }

  if (context.note.seo.ogImageSubtitle) {
    fields.ogImageSubtitle = localize(context.note.seo.ogImageSubtitle, context.note.locale)
  }

  if (context.note.seo.keywords.length > 0) {
    fields.keywords = localize(context.note.seo.keywords, context.note.locale)
  }

  const entry = await upsertEntry(context.client, context.note.seoEntryId, CONTENT_TYPES.SEO, fields)

  if (context.mode === 'publish') {
    await publishEntry(context.client, entry.sys.id)
  }

  return getEntry(context.client, entry.sys.id)
}

async function markdownToRichText(markdown, context) {
  const content = []
  const lines = normalizeLineEndings(markdown).split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed === '') {
      index += 1
      continue
    }

    const codeFence = matchCodeFence(line)
    if (codeFence) {
      const { nextIndex, content: codeContent } = collectCodeBlock(lines, index, codeFence.fence)
      const entryId = buildStableId('code', `${context.note.entryId}:${context.counters.codeBlock}`)
      context.counters.codeBlock += 1
      const entry = await upsertEntry(context.client, entryId, CONTENT_TYPES.CODE_BLOCK, {
        title: localize(
          codeFence.language ? `${context.note.title} (${codeFence.language})` : `${context.note.title} code block`,
          context.note.locale
        ),
        code: localize(codeContent, context.note.locale)
      })

      if (context.mode === 'publish') {
        await publishEntry(context.client, entry.sys.id)
      }

      content.push(createEmbeddedEntryParagraph(entry.sys.id))
      index = nextIndex
      continue
    }

    const directive = matchContentfulDirective(trimmed)
    if (directive) {
      const embeddedEntry = await upsertDirectiveEntry(context, directive)
      content.push(createEmbeddedEntryParagraph(embeddedEntry.sys.id))
      index += 1
      continue
    }

    const imageMatch = matchImageLine(trimmed)
    if (imageMatch) {
      const asset = await upsertAssetFromSource(context, {
        source: imageMatch.source,
        title: imageMatch.title || context.note.title,
        description: imageMatch.description
      })

      content.push(createEmbeddedAssetBlock(asset.sys.id))
      index += 1
      continue
    }

    if (isHorizontalRule(trimmed)) {
      content.push({
        nodeType: 'hr',
        data: {},
        content: []
      })
      index += 1
      continue
    }

    const headingMatch = matchHeading(trimmed)
    if (headingMatch) {
      content.push({
        nodeType: mapHeadingLevel(headingMatch.level),
        data: {},
        content: parseInlineContent(headingMatch.text)
      })
      index += 1
      continue
    }

    if (isBlockquote(trimmed)) {
      const { nextIndex, node } = collectBlockquote(lines, index)
      content.push(node)
      index = nextIndex
      continue
    }

    const listMatch = matchListLine(trimmed)
    if (listMatch) {
      const { nextIndex, node } = collectList(lines, index, listMatch.type)
      content.push(node)
      index = nextIndex
      continue
    }

    const { nextIndex, paragraph } = collectParagraph(lines, index)
    content.push({
      nodeType: 'paragraph',
      data: {},
      content: parseInlineContent(paragraph)
    })
    index = nextIndex
  }

  return {
    nodeType: 'document',
    data: {},
    content
  }
}

async function upsertDirectiveEntry(context, directive) {
  if (directive.type === 'tweet') {
    const tweetId = readRequiredAttribute(directive.attributes, 'id', 'contentful-tweet')
    const entryId = buildStableId('tweet', `${context.note.entryId}:${tweetId}`)
    const entry = await upsertEntry(context.client, entryId, CONTENT_TYPES.TWEET, {
      id: localize(tweetId, context.note.locale)
    })

    if (context.mode === 'publish') {
      await publishEntry(context.client, entry.sys.id)
    }

    return entry
  }

  if (directive.type === 'embed') {
    const embedUrl = readRequiredAttribute(directive.attributes, 'url', 'contentful-embed')
    const embedType = readRequiredAttribute(directive.attributes, 'type', 'contentful-embed')
    if (!['Video', 'SoundCloud'].includes(embedType)) {
      throw new Error('contentful-embed type must be Video or SoundCloud')
    }

    const entryId = buildStableId('embed', `${context.note.entryId}:${context.counters.embed}`)
    context.counters.embed += 1
    const entry = await upsertEntry(context.client, entryId, CONTENT_TYPES.CONTENT_EMBED, {
      title: localize(directive.attributes.title || context.note.title, context.note.locale),
      embedUrl: localize(embedUrl, context.note.locale),
      type: localize(embedType, context.note.locale)
    })

    if (context.mode === 'publish') {
      await publishEntry(context.client, entry.sys.id)
    }

    return entry
  }

  if (directive.type === 'carousel') {
    const imagesValue = readRequiredAttribute(directive.attributes, 'images', 'contentful-carousel')
    const imageSources = imagesValue
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)

    if (imageSources.length === 0) {
      throw new Error('contentful-carousel images must contain at least one path or URL')
    }

    const imageLinks = []
    for (const source of imageSources) {
      const asset = await upsertAssetFromSource(context, {
        source,
        title: directive.attributes.title || context.note.title,
        description: directive.attributes.description || ''
      })

      imageLinks.push(linkObject('Asset', asset.sys.id))
    }

    const entryId = buildStableId('carousel', `${context.note.entryId}:${context.counters.embed}`)
    context.counters.embed += 1
    const entry = await upsertEntry(context.client, entryId, CONTENT_TYPES.CAROUSEL, {
      title: localize(directive.attributes.title || context.note.title, context.note.locale),
      images: localize(imageLinks, context.note.locale)
    })

    if (context.mode === 'publish') {
      await publishEntry(context.client, entry.sys.id)
    }

    return entry
  }

  throw new Error(`Unsupported contentful directive: ${directive.type}`)
}

async function upsertAssetFromSource(context, options) {
  const source = String(options.source || '').trim()
  if (!source) {
    throw new Error('Asset source is required')
  }

  const isRemote = /^https?:\/\//i.test(source)
  const identity = isRemote ? source : (resolveVaultFile(context.app, context.file, source)?.path ?? source)
  const assetId = buildStableId('asset', identity)
  const title = String(options.title || guessAssetTitle(source)).trim() || guessAssetTitle(source)
  const description = String(options.description || '').trim()
  const existing = await getAsset(context.client, assetId)

  let fileField

  if (isRemote) {
    fileField = {
      contentType: guessMimeType(source),
      fileName: guessAssetFileName(source),
      upload: source
    }
  } else {
    const file = resolveVaultFile(context.app, context.file, source)
    if (!file) {
      throw new Error(`Asset file not found in vault: ${source}`)
    }

    const binary = await context.app.vault.readBinary(file)
    const upload = await uploadBinary(context.client, binary)
    fileField = {
      contentType: guessMimeType(file.path),
      fileName: guessAssetFileName(file.path),
      uploadFrom: linkObject('Upload', upload.sys.id)
    }
  }

  const asset = await upsertAsset(
    context.client,
    assetId,
    {
      title: localize(title, context.note.locale),
      description: localize(description, context.note.locale),
      file: localize(fileField, context.note.locale)
    },
    existing?.sys?.version
  )

  await processAsset(context.client, asset.sys.id, context.note.locale)

  if (context.mode === 'publish') {
    await publishAsset(context.client, asset.sys.id)
  }

  return getAsset(context.client, asset.sys.id)
}

function normalizeNote(file, rawMarkdown, frontmatter, defaultLocale) {
  const contentType = normalizeContentType(
    frontmatter.contentful_content_type ?? frontmatter.content_type ?? frontmatter.type
  )
  const bodyMarkdown = stripLeadingTitleHeading(
    stripFrontmatter(rawMarkdown),
    readString(frontmatter.title) || extractFirstHeading(rawMarkdown)
  )
  const title = readRequiredString(frontmatter.title || extractFirstHeading(rawMarkdown), 'title')
  const locale = readString(frontmatter.contentful_locale) || defaultLocale

  if (contentType === CONTENT_TYPES.LOGBOOK) {
    const entryId = readString(frontmatter.contentful_entry_id) || buildStableId(contentType, file.path)
    const description =
      readString(frontmatter.description) || readString(frontmatter.summary) || extractExcerpt(bodyMarkdown, 220)
    const date = normalizeDate(frontmatter.date || todayDate())

    return {
      bodyMarkdown,
      contentType,
      date,
      description: readRequiredString(description, 'description'),
      entryId,
      filePath: file.path,
      locale,
      title
    }
  }

  const slug = slugify(readString(frontmatter.slug) || title)
  const entryId = readString(frontmatter.contentful_entry_id) || buildStableId(contentType, `${contentType}:${slug}`)
  const seoEntryId = readString(frontmatter.contentful_seo_entry_id) || buildStableId('seo', `${entryId}:${slug}`)
  const seoDescription =
    readString(frontmatter.seo_description) ||
    readString(frontmatter.description) ||
    readString(frontmatter.summary) ||
    extractExcerpt(bodyMarkdown, 160)

  return {
    bodyMarkdown,
    contentType,
    date:
      contentType === CONTENT_TYPES.POST && (frontmatter.date || todayDate())
        ? normalizeDate(frontmatter.date || todayDate())
        : '',
    entryId,
    filePath: file.path,
    hasCustomPage: readBoolean(frontmatter.hasCustomPage ?? frontmatter.has_custom_page),
    locale,
    seo: {
      description: readRequiredString(seoDescription, 'seo_description'),
      keywords: readStringArray(frontmatter.seo_keywords),
      ogImageSubtitle: readString(frontmatter.seo_og_image_subtitle),
      ogImageTitle: readString(frontmatter.seo_og_image_title) || title,
      title: readString(frontmatter.seo_title) || title
    },
    seoEntryId,
    slug,
    title
  }
}

function normalizeContentType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  const resolved = CONTENT_TYPE_ALIASES[normalized]
  if (!resolved) {
    throw new Error('contentful_content_type must be one of: writing, post, page, journal, journey, logbook')
  }

  return resolved
}

function createContentfulClient(config) {
  const environmentBasePath = `/spaces/${config.spaceId}/environments/${config.environmentId}`

  return {
    config,
    environmentBasePath,
    async request(method, targetPath, options = {}) {
      const url = `${options.baseUrl || config.cmaBaseUrl}${targetPath}`
      const headers = {
        Authorization: `Bearer ${config.managementToken}`,
        ...options.headers
      }

      if (options.json !== false) {
        headers['Content-Type'] = 'application/vnd.contentful.management.v1+json'
      }

      if (typeof options.version === 'number') {
        headers['X-Contentful-Version'] = String(options.version)
      }

      if (options.contentTypeId) {
        headers['X-Contentful-Content-Type'] = options.contentTypeId
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options.body
      })

      const text = await response.text()
      const payload = tryParseJson(text)

      if (!response.ok) {
        if (options.allowNotFound && response.status === 404) {
          return null
        }

        const details = payload?.message || payload?.details?.errors?.[0]?.details || text || response.statusText
        throw new Error(`Contentful API error ${response.status}: ${details}`)
      }

      if (text === '') {
        return {}
      }

      return payload
    }
  }
}

function buildUpdatedFrontmatter(frontmatter, updates) {
  const merged = {
    ...frontmatter,
    ...updates
  }

  if (!merged.slug && updates.slug) {
    merged.slug = updates.slug
  }

  return orderFrontmatterKeys(merged)
}

async function writeFrontmatter(app, obsidian, file, rawMarkdown, frontmatter) {
  const body = stripFrontmatter(rawMarkdown).replace(/^\n+/, '')
  const yaml = obsidian.stringifyYaml(frontmatter).trim()
  const nextMarkdown = `---\n${yaml}\n---\n\n${body}`

  if (normalizeLineEndings(nextMarkdown) !== normalizeLineEndings(rawMarkdown)) {
    await app.vault.modify(file, nextMarkdown)
  }
}

function sanitizeFrontmatter(frontmatter) {
  const value = { ...(frontmatter || {}) }
  delete value.position
  return value
}

function readFrontmatter(app, file) {
  const cache = app.metadataCache.getFileCache(file)
  return cache?.frontmatter ?? {}
}

function readSettings(settings) {
  const config = {
    cmaBaseUrl: normalizeBaseUrl(
      readResolvedSetting(settings.cmaBaseUrl, {
        defaultValue: DEFAULT_CMA_BASE_URL,
        envKey: 'CONTENTFUL_CMA_BASE_URL',
        fieldName: 'cmaBaseUrl'
      })
    ),
    environmentId: readRequiredString(
      readResolvedSetting(settings.environmentId, {
        defaultValue: 'master',
        envKey: 'CONTENTFUL_ENVIRONMENT_ID',
        fieldName: 'environmentId'
      }),
      'environmentId'
    ),
    locale: readResolvedSetting(settings.locale, {
      defaultValue: DEFAULT_LOCALE,
      envKey: 'CONTENTFUL_LOCALE',
      fieldName: 'locale'
    }),
    managementToken: readRequiredString(
      readResolvedSetting(settings.managementToken, {
        defaultValue: '',
        envKey: 'CONTENTFUL_MANAGEMENT_TOKEN',
        fieldName: 'managementToken'
      }),
      'managementToken'
    ),
    revalidateSecret: readResolvedSetting(settings.revalidateSecret, {
      defaultValue: '',
      envKey: 'NEXT_REVALIDATE_SECRET',
      fieldName: 'revalidateSecret'
    }),
    revalidateUrl: normalizeBaseUrl(
      readResolvedSetting(settings.revalidateUrl, {
        defaultValue: '',
        envKey: 'NEXT_REVALIDATE_URL',
        fieldName: 'revalidateUrl'
      })
    ),
    showNotice: settings.showNotice !== false,
    spaceId: readRequiredString(
      readResolvedSetting(settings.spaceId, {
        defaultValue: '',
        envKey: 'CONTENTFUL_SPACE_ID',
        fieldName: 'spaceId'
      }),
      'spaceId'
    ),
    uploadBaseUrl: normalizeBaseUrl(
      readResolvedSetting(settings.uploadBaseUrl, {
        defaultValue: DEFAULT_UPLOAD_BASE_URL,
        envKey: 'CONTENTFUL_UPLOAD_BASE_URL',
        fieldName: 'uploadBaseUrl'
      })
    )
  }

  return config
}

function normalizeMode(mode) {
  if (mode !== 'preview' && mode !== 'publish') {
    throw new Error(`Invalid sync mode: ${mode}`)
  }

  return mode
}

function localize(value, locale) {
  return {
    [locale]: value
  }
}

function linkObject(linkType, id) {
  return {
    sys: {
      type: 'Link',
      linkType,
      id
    }
  }
}

async function getEntry(client, entryId) {
  return client.request('GET', entryPath(client, entryId), {
    allowNotFound: true
  })
}

async function upsertEntry(client, entryId, contentTypeId, fields) {
  const existing = await getEntry(client, entryId)
  const version = existing?.sys?.version

  return client.request('PUT', entryPath(client, entryId), {
    body: JSON.stringify({ fields }),
    contentTypeId,
    version
  })
}

async function publishEntry(client, entryId) {
  const current = await getEntry(client, entryId)
  if (!current) {
    throw new Error(`Entry not found for publish: ${entryId}`)
  }

  return client.request('PUT', `${entryPath(client, entryId)}/published`, {
    body: '',
    version: current.sys.version
  })
}

async function getAsset(client, assetId) {
  return client.request('GET', assetPath(client, assetId), {
    allowNotFound: true
  })
}

async function upsertAsset(client, assetId, fields, version) {
  return client.request('PUT', assetPath(client, assetId), {
    body: JSON.stringify({ fields }),
    version
  })
}

async function processAsset(client, assetId, locale) {
  const current = await getAsset(client, assetId)
  if (!current) {
    throw new Error(`Asset not found for processing: ${assetId}`)
  }

  await client.request('PUT', `${assetPath(client, assetId)}/files/${encodeURIComponent(locale)}/process`, {
    body: '',
    version: current.sys.version
  })

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500)
    const processed = await getAsset(client, assetId)
    if (processed?.fields?.file?.[locale]?.url) {
      return processed
    }
  }

  throw new Error(`Asset processing timed out: ${assetId}`)
}

async function publishAsset(client, assetId) {
  const current = await getAsset(client, assetId)
  if (!current) {
    throw new Error(`Asset not found for publish: ${assetId}`)
  }

  return client.request('PUT', `${assetPath(client, assetId)}/published`, {
    body: '',
    version: current.sys.version
  })
}

async function uploadBinary(client, binary) {
  const body = Buffer.from(binary)

  return client.request('POST', `/spaces/${client.config.spaceId}/uploads`, {
    baseUrl: client.config.uploadBaseUrl,
    body,
    headers: {
      'Content-Type': 'application/octet-stream'
    },
    json: false
  })
}

async function triggerRevalidation(config, note) {
  if (!config.revalidateUrl || !config.revalidateSecret) {
    return false
  }

  const payload = {
    contentTypeId: note.contentType
  }

  if (note.slug) {
    payload.slug = note.slug
  }

  const response = await fetch(config.revalidateUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-revalidate-secret': config.revalidateSecret
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Revalidate request failed: ${response.status} ${text}`)
  }

  return true
}
function entryPath(client, entryId) {
  return `${client.environmentBasePath}/entries/${encodeURIComponent(entryId)}`
}

function assetPath(client, assetId) {
  return `${client.environmentBasePath}/assets/${encodeURIComponent(assetId)}`
}

function stripFrontmatter(markdown) {
  return String(markdown || '').replace(FRONTMATTER_REGEX, '')
}

function stripLeadingTitleHeading(markdown, title) {
  const lines = normalizeLineEndings(markdown).split('\n')
  let index = 0

  while (index < lines.length && lines[index].trim() === '') {
    index += 1
  }

  const firstLine = lines[index] || ''
  const headingMatch = firstLine.match(/^#\s+(.+)$/)
  if (!headingMatch) {
    return markdown
  }

  if (slugify(headingMatch[1]) !== slugify(title || '')) {
    return markdown
  }

  const remaining = lines.slice(index + 1)
  while (remaining.length > 0 && remaining[0].trim() === '') {
    remaining.shift()
  }

  return remaining.join('\n')
}

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n')
}

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
}

function readRequiredString(value, fieldName) {
  const normalized = readString(value)
  if (!normalized) {
    throw new Error(`${fieldName} is required`)
  }

  return normalized
}

function readString(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function readResolvedSetting(value, options = {}) {
  const directValue = readString(value)
  const referencedEnvKey = readEnvReference(directValue)

  if (referencedEnvKey) {
    const envValue = readString(process.env[referencedEnvKey])
    if (!envValue) {
      throw new Error(`Environment variable "${referencedEnvKey}" is not set for ${options.fieldName || 'setting'}`)
    }

    return envValue
  }

  if (directValue) {
    return directValue
  }

  if (options.envKey) {
    const defaultEnvValue = readString(process.env[options.envKey])
    if (defaultEnvValue) {
      return defaultEnvValue
    }
  }

  return readString(options.defaultValue)
}

function readEnvReference(value) {
  const match = String(value || '').match(/^env:(.+)$/i)
  return match ? match[1].trim() : ''
}

function readStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function readBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }

  return undefined
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  const normalized = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`)
  }

  return date.toISOString().slice(0, 10)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildStableId(prefix, seed) {
  return `${prefix}-${crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 24)}`
}

function extractFirstHeading(markdown) {
  const match = normalizeLineEndings(stripFrontmatter(markdown)).match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

function extractExcerpt(markdown, maxLength) {
  const plain = normalizeInlineText(
    normalizeLineEndings(markdown)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^>\s?/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, ' ')
      .replace(/!\[\[[^\]]+\]\]/g, ' ')
      .replace(/\{\{contentful-[^}]+\}\}/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) {
    return ''
  }

  if (plain.length <= maxLength) {
    return plain
  }

  return `${plain.slice(0, maxLength - 1).trim()}…`
}

function matchCodeFence(line) {
  const match = line.match(/^(```+|~~~+)\s*([\w-]+)?\s*$/)
  if (!match) {
    return null
  }

  return {
    fence: match[1],
    language: match[2] || ''
  }
}

function collectCodeBlock(lines, startIndex, fence) {
  const content = []
  let index = startIndex + 1

  while (index < lines.length) {
    if (lines[index].startsWith(fence)) {
      return {
        content: content.join('\n'),
        nextIndex: index + 1
      }
    }

    content.push(lines[index])
    index += 1
  }

  return {
    content: content.join('\n'),
    nextIndex: index
  }
}

function matchContentfulDirective(line) {
  const match = line.match(/^\{\{contentful-(tweet|embed|carousel)\s+(.+)\}\}$/)
  if (!match) {
    return null
  }

  return {
    type: match[1],
    attributes: parseDirectiveAttributes(match[2])
  }
}

function parseDirectiveAttributes(value) {
  const attributes = {}
  const regex = /(\w+)="([^"]*)"/g
  let match

  while ((match = regex.exec(value)) !== null) {
    attributes[match[1]] = match[2]
  }

  return attributes
}

function readRequiredAttribute(attributes, key, directiveName) {
  const value = readString(attributes[key])
  if (!value) {
    throw new Error(`${directiveName} requires "${key}"`)
  }

  return value
}

function matchImageLine(line) {
  const markdownImage = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/)
  if (markdownImage) {
    return {
      source: markdownImage[2],
      description: markdownImage[1],
      title: markdownImage[3] || guessAssetTitle(markdownImage[2])
    }
  }

  const obsidianImage = line.match(/^!\[\[([^\]]+)\]\]$/)
  if (obsidianImage) {
    const [source, alias] = obsidianImage[1].split('|').map((item) => item.trim())
    return {
      source,
      description: alias || '',
      title: alias || guessAssetTitle(source)
    }
  }

  return null
}

function extractBlockImageSources(markdown) {
  return normalizeLineEndings(markdown)
    .split('\n')
    .map((line) => matchImageLine(line.trim()))
    .filter(Boolean)
    .map((match) => match.source)
}

function isHorizontalRule(line) {
  return /^([-*_])(?:\s*\1){2,}$/.test(line)
}

function matchHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.+)$/)
  if (!match) {
    return null
  }

  return {
    level: match[1].length,
    text: match[2].trim()
  }
}

function mapHeadingLevel(level) {
  if (level <= 2) return 'heading-2'
  return 'heading-3'
}

function isBlockquote(line) {
  return /^>\s?/.test(line)
}

function collectBlockquote(lines, startIndex) {
  const quoteLines = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      quoteLines.push('')
      index += 1
      continue
    }

    if (!isBlockquote(line.trim())) {
      break
    }

    quoteLines.push(line.replace(/^>\s?/, ''))
    index += 1
  }

  const paragraphs = quoteLines
    .join('\n')
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n+/g, ' ').trim())
    .filter(Boolean)
    .map((text) => ({
      nodeType: 'paragraph',
      data: {},
      content: parseInlineContent(text)
    }))

  return {
    nextIndex: index,
    node: {
      nodeType: 'blockquote',
      data: {},
      content: paragraphs
    }
  }
}

function matchListLine(line) {
  if (/^[-*+]\s+/.test(line)) {
    return {
      type: 'unordered'
    }
  }

  if (/^\d+\.\s+/.test(line)) {
    return {
      type: 'ordered'
    }
  }

  return null
}

function collectList(lines, startIndex, listType) {
  const items = []
  let current = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed === '') {
      if (current.length > 0) {
        items.push(current.join(' ').trim())
        current = []
      }
      index += 1
      break
    }

    const isSameListType =
      (listType === 'unordered' && /^[-*+]\s+/.test(trimmed)) || (listType === 'ordered' && /^\d+\.\s+/.test(trimmed))

    if (isSameListType) {
      if (current.length > 0) {
        items.push(current.join(' ').trim())
      }

      current = [trimmed.replace(listType === 'unordered' ? /^[-*+]\s+/ : /^\d+\.\s+/, '')]
      index += 1
      continue
    }

    if (startsBlock(trimmed)) {
      break
    }

    current.push(trimmed)
    index += 1
  }

  if (current.length > 0) {
    items.push(current.join(' ').trim())
  }

  return {
    nextIndex: index,
    node: {
      nodeType: listType === 'unordered' ? 'unordered-list' : 'ordered-list',
      data: {},
      content: items.map((item) => ({
        nodeType: 'list-item',
        data: {},
        content: [
          {
            nodeType: 'paragraph',
            data: {},
            content: parseInlineContent(item)
          }
        ]
      }))
    }
  }
}

function collectParagraph(lines, startIndex) {
  const parts = []
  let index = startIndex

  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (trimmed === '') {
      break
    }

    if (parts.length > 0 && startsBlock(trimmed)) {
      break
    }

    parts.push(trimmed)
    index += 1
  }

  return {
    nextIndex: index,
    paragraph: parts.join(' ')
  }
}

function startsBlock(line) {
  return Boolean(
    matchCodeFence(line) ||
      matchContentfulDirective(line) ||
      matchImageLine(line) ||
      isHorizontalRule(line) ||
      matchHeading(line) ||
      isBlockquote(line) ||
      matchListLine(line)
  )
}

function parseInlineContent(text) {
  const normalized = normalizeInlineText(text)
  const nodes = []
  let index = 0

  while (index < normalized.length) {
    const token = findNextInlineToken(normalized, index)
    if (!token) {
      pushTextNode(nodes, normalized.slice(index))
      break
    }

    if (token.index > index) {
      pushTextNode(nodes, normalized.slice(index, token.index))
    }

    if (token.type === 'link') {
      nodes.push({
        nodeType: 'hyperlink',
        data: {
          uri: token.url
        },
        content: parseMarkedText(token.label)
      })
    } else {
      for (const node of parseMarkedText(token.text, token.type)) {
        nodes.push(node)
      }
    }

    index = token.end
  }

  return mergeTextNodes(nodes)
}

function findNextInlineToken(text, startIndex) {
  const slice = text.slice(startIndex)
  const candidates = [
    createTokenMatch('link', /\[([^\]]+)\]\(([^)]+)\)/, slice),
    createTokenMatch('code', /`([^`]+)`/, slice),
    createTokenMatch('bold', /\*\*([^*]+)\*\*/, slice),
    createTokenMatch('italic', /(?<!\*)\*([^*]+)\*(?!\*)/, slice),
    createTokenMatch('italic', /_([^_]+)_/, slice)
  ].filter(Boolean)

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => left.index - right.index)
  const candidate = candidates[0]
  candidate.index += startIndex
  candidate.end += startIndex
  return candidate
}

function createTokenMatch(type, regex, text) {
  const match = text.match(regex)
  if (!match || typeof match.index !== 'number') {
    return null
  }

  if (type === 'link') {
    return {
      end: match.index + match[0].length,
      index: match.index,
      label: match[1],
      type,
      url: match[2]
    }
  }

  return {
    end: match.index + match[0].length,
    index: match.index,
    text: match[1],
    type
  }
}

function parseMarkedText(text, markType) {
  const marks = []
  if (markType) {
    marks.push({
      type: markType
    })
  }

  return [
    {
      nodeType: 'text',
      value: text,
      marks,
      data: {}
    }
  ]
}

function pushTextNode(nodes, value) {
  if (!value) {
    return
  }

  nodes.push({
    nodeType: 'text',
    value,
    marks: [],
    data: {}
  })
}

function mergeTextNodes(nodes) {
  const merged = []

  for (const node of nodes) {
    const previous = merged[merged.length - 1]
    if (
      previous &&
      node.nodeType === 'text' &&
      previous.nodeType === 'text' &&
      JSON.stringify(previous.marks) === JSON.stringify(node.marks)
    ) {
      previous.value += node.value
      continue
    }

    merged.push(node)
  }

  return merged
}

function normalizeInlineText(text) {
  return String(text || '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, link) => guessAssetTitle(link))
}

function createEmbeddedEntryParagraph(entryId) {
  return {
    nodeType: 'paragraph',
    data: {},
    content: [
      {
        nodeType: 'embedded-entry-inline',
        data: {
          target: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: entryId
            }
          }
        },
        content: []
      }
    ]
  }
}

function createEmbeddedAssetBlock(assetId) {
  return {
    nodeType: 'embedded-asset-block',
    data: {
      target: {
        sys: {
          type: 'Link',
          linkType: 'Asset',
          id: assetId
        }
      }
    },
    content: []
  }
}

function resolveVaultFile(app, noteFile, source) {
  const normalizedSource = String(source || '').trim()
  if (!normalizedSource) {
    return null
  }

  const directCandidates = [
    normalizedSource.replace(/^\/+/, ''),
    path.posix.normalize(path.posix.join(path.posix.dirname(noteFile.path), normalizedSource))
  ]

  for (const candidate of directCandidates) {
    const file = app.vault.getAbstractFileByPath(candidate)
    if (file?.path) {
      return file
    }
  }

  return app.metadataCache.getFirstLinkpathDest(normalizedSource, noteFile.path)
}

function guessAssetFileName(source) {
  if (/^https?:\/\//i.test(source)) {
    const url = new URL(source)
    const fileName = path.posix.basename(url.pathname)
    return fileName || 'asset'
  }

  return path.posix.basename(source)
}

function guessAssetTitle(source) {
  const fileName = guessAssetFileName(source)
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || fileName
  )
}

function guessMimeType(source) {
  const extension = path.extname(guessAssetFileName(source)).toLowerCase()
  return MIME_TYPES[extension] || 'application/octet-stream'
}

function tryParseJson(text) {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function uniqueValues(values) {
  return [...new Set(values)]
}

function orderFrontmatterKeys(frontmatter) {
  const preferredOrder = [
    'contentful_content_type',
    'title',
    'slug',
    'date',
    'description',
    'hasCustomPage',
    'seo_title',
    'seo_description',
    'seo_og_image_title',
    'seo_og_image_subtitle',
    'seo_keywords',
    'images',
    'summary',
    'tags',
    'contentful_entry_id',
    'contentful_seo_entry_id',
    'contentful_locale',
    'contentful_last_mode',
    'contentful_last_synced_at',
    'contentful_last_published_at'
  ]

  const ordered = {}

  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
      ordered[key] = frontmatter[key]
    }
  }

  for (const key of Object.keys(frontmatter)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = frontmatter[key]
    }
  }

  return ordered
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
