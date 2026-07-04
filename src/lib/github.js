import 'server-only'

import { cacheLife } from 'next/cache'

const PROFILE_OWNER = 'ryan-alexander-zhang'
const PROFILE_REPOSITORY = 'ryan-alexander-zhang/ryan-alexander-zhang'
const PROFILE_BRANCH = 'main'
const GITHUB_PROFILE_URL = `https://github.com/${PROFILE_OWNER}`
const GITHUB_USER_API_URL = `https://api.github.com/users/${PROFILE_OWNER}`
const README_URL = `https://raw.githubusercontent.com/${PROFILE_REPOSITORY}/${PROFILE_BRANCH}/README.md`
const README_LINK_BASE_URL = `https://github.com/${PROFILE_REPOSITORY}/blob/${PROFILE_BRANCH}/`
const README_IMAGE_BASE_URL = `https://raw.githubusercontent.com/${PROFILE_REPOSITORY}/${PROFILE_BRANCH}/`
const HOME_SECTION_START = '<!-- site:home:start -->'
const HOME_SECTION_END = '<!-- site:home:end -->'
const FALLBACK_HOME_MARKDOWN = `# Hi , I'm Ryan

### A passionate backend developer from China

- I’m currently learning Java, Spring Boot, Architecture etc.
- Ask me about Java, Redis and Architecture
- How to reach me ryan.alexander.zhang@gmail.com
- ⚡ Fun fact I think I'm funny, and I enjoy playing games like League of Legends and various Steam games.
`
const FALLBACK_GITHUB_PROFILE = {
  name: 'Ryan Alexander Zhang',
  bio: 'A passionate backend developer from China',
  avatarUrl: `https://avatars.githubusercontent.com/${PROFILE_OWNER}`,
  profileUrl: GITHUB_PROFILE_URL,
  websiteUrl: '',
  twitterUsername: '',
  onlineLinks: getOnlineLinks({
    profileUrl: GITHUB_PROFILE_URL,
    websiteUrl: '',
    twitterUsername: ''
  })
}

function getGithubHeaders(accept) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN

  return {
    Accept: accept,
    'User-Agent': `${PROFILE_OWNER}-site`,
    ...(token && {
      Authorization: `Bearer ${token}`
    })
  }
}

async function fetchGithubProfile() {
  const response = await fetch(GITHUB_USER_API_URL, {
    headers: getGithubHeaders('application/vnd.github+json'),
    next: {
      revalidate: 60 * 60
    },
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${response.status}`)
  }

  return response.json()
}

function ensureAbsoluteUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

function getOnlineLinks({ profileUrl, websiteUrl, twitterUsername }) {
  return [
    { title: 'GitHub', url: profileUrl, iconKey: 'github' },
    ...(websiteUrl ? [{ title: 'Eng Copilot', url: websiteUrl, iconKey: 'website' }] : []),
    ...(twitterUsername ? [{ title: 'X (Twitter)', url: `https://x.com/${twitterUsername}`, iconKey: 'twitter' }] : []),
    { title: 'WeChat', url: '/wechat', iconKey: 'wechat' }
  ]
}

function extractMarkedSection(markdown) {
  const start = markdown.indexOf(HOME_SECTION_START)
  const end = markdown.indexOf(HOME_SECTION_END)

  if (start === -1 || end === -1 || end <= start) return null

  return markdown.slice(start + HOME_SECTION_START.length, end).trim()
}

function extractIntroSection(markdown) {
  const markedSection = extractMarkedSection(markdown)
  if (markedSection) return markedSection

  const connectHeadingMatch = markdown.match(
    /(^###\s+Connect with me:?\s*$)|(^<h[1-6][^>]*>\s*Connect with me:?\s*<\/h[1-6]>\s*$)/im
  )
  if (connectHeadingMatch?.index) {
    return markdown.slice(0, connectHeadingMatch.index).trim()
  }

  const nextTopLevelSectionMatch = markdown.match(/^##\s+/m)
  if (nextTopLevelSectionMatch?.index) {
    return markdown.slice(0, nextTopLevelSectionMatch.index).trim()
  }

  return markdown.trim()
}

export async function getGithubProfile() {
  'use cache'
  cacheLife('hours')

  try {
    const profile = await fetchGithubProfile()
    const profileUrl = profile?.html_url || FALLBACK_GITHUB_PROFILE.profileUrl
    const websiteUrl = ensureAbsoluteUrl(profile?.blog)
    const twitterUsername = profile?.twitter_username || ''

    return {
      name: profile?.name || FALLBACK_GITHUB_PROFILE.name,
      bio: profile?.bio || FALLBACK_GITHUB_PROFILE.bio,
      avatarUrl: profile?.avatar_url || FALLBACK_GITHUB_PROFILE.avatarUrl,
      profileUrl,
      websiteUrl,
      twitterUsername,
      onlineLinks: getOnlineLinks({ profileUrl, websiteUrl, twitterUsername })
    }
  } catch (error) {
    console.error('Failed to load GitHub profile data:', error)
    return FALLBACK_GITHUB_PROFILE
  }
}

export async function getHomeProfileReadme() {
  'use cache'
  cacheLife('hours')

  try {
    const response = await fetch(README_URL, {
      headers: getGithubHeaders('text/plain; charset=utf-8'),
      next: {
        revalidate: 60 * 60
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch README: ${response.status}`)
    }

    const markdown = await response.text()

    return {
      markdown: extractIntroSection(markdown) || FALLBACK_HOME_MARKDOWN,
      linkBaseUrl: README_LINK_BASE_URL,
      imageBaseUrl: README_IMAGE_BASE_URL
    }
  } catch (error) {
    console.error('Failed to load GitHub README for home page:', error)

    return {
      markdown: FALLBACK_HOME_MARKDOWN,
      linkBaseUrl: README_LINK_BASE_URL,
      imageBaseUrl: README_IMAGE_BASE_URL
    }
  }
}
