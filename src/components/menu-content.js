'use client'

import NextLink from 'next/link'
import { FaGithub as GithubIcon, FaGlobe as GlobeIcon, FaWeixin as WechatIcon } from 'react-icons/fa'
import { FaXTwitter as XIcon } from 'react-icons/fa6'

import { useGithubProfile } from '@/components/github-profile-provider'
import { NavigationLink } from '@/components/navigation-link'
import { LINKS } from '@/lib/constants'

function getProfileIcon(iconKey) {
  switch (iconKey) {
    case 'github':
      return <GithubIcon size={16} />
    case 'website':
      return <GlobeIcon size={16} />
    case 'twitter':
      return <XIcon size={16} />
    case 'wechat':
      return <WechatIcon size={16} />
    default:
      return <GlobeIcon size={16} />
  }
}

export const MenuContent = () => {
  const profile = useGithubProfile()
  if (!profile) return null

  return (
    <div className="flex w-full flex-col text-sm">
      <div className="flex flex-col gap-4">
        <NextLink href="/" className="link-card inline-flex items-center gap-2 p-2">
          <img
            src={profile.avatarUrl}
            alt={profile.name}
            width={40}
            height={40}
            loading="lazy"
            className="rounded-full border shadow-xs"
            nopin="nopin"
          />
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight">{profile.name}</span>
            <span className="text-gray-600">{profile.bio}</span>
          </div>
        </NextLink>
        <div className="flex flex-col gap-1">
          {LINKS.map((link, linkIndex) => (
            <NavigationLink
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              shortcutNumber={linkIndex + 1}
            />
          ))}
        </div>
      </div>
      <hr />
      <div className="flex flex-col gap-2 text-sm">
        <span className="px-2 text-xs leading-relaxed font-medium text-gray-600">Online</span>
        <div className="flex flex-col gap-1">
          {profile.onlineLinks.map((link) => (
            <NavigationLink key={link.url} href={link.url} label={link.title} icon={getProfileIcon(link.iconKey)} />
          ))}
        </div>
      </div>
    </div>
  )
}
