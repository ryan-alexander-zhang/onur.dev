'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export function BookmarkGroups({ groups }) {
  const pathname = usePathname()
  const params = useSearchParams().toString()
  const choices = [{ slug: '', title: 'All bookmarks', count: groups.reduce((sum, g) => sum + g.count, 0) }, ...groups]
  return (
    <nav aria-label="Bookmark groups" className="flex flex-col gap-1 text-sm">
      {choices.map((group) => {
        const path = `/bookmarks${group.slug ? '/' + group.slug : ''}`
        const active = pathname === path
        return (
          <Link
            key={path}
            href={`${path}${params ? '?' + params : ''}`}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col gap-1 rounded-lg p-2 transition-colors ${active ? 'bg-black text-white' : 'hover:bg-gray-200'}`}
          >
            <span className="font-medium">{group.title}</span>
            <span className={active ? 'text-slate-300' : 'text-slate-500'}>{group.count} bookmarks</span>
          </Link>
        )
      })}
    </nav>
  )
}
