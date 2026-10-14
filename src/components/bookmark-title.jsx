'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LuChevronDown } from 'react-icons/lu'

export function BookmarkTitle({ title, groups, id = '' }) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <div className="mb-6 flex items-center gap-2">
      <h1 className="text-balance">{title}</h1>
      <div className="relative flex size-8 items-center justify-center rounded focus-within:ring-2 focus-within:ring-gray-300 lg:hidden">
        <LuChevronDown aria-hidden="true" size={18} className="text-gray-400" />
        <select
          aria-label="Bookmark group"
          value={id}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          onChange={(event) => {
            router.push(
              `/bookmarks${event.target.value ? '/' + event.target.value : ''}${params.size ? '?' + params.toString() : ''}`
            )
          }}
        >
          <option value="">All bookmarks</option>
          {groups.map((group) => (
            <option key={group._id} value={group.slug}>
              {group.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
