'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { LuArrowUp, LuHash, LuLoaderCircle, LuSearch, LuX } from 'react-icons/lu'

// A trailing #token is a tag being composed, never a content search term.
function splitInput(text) {
  const match = text.match(/(?:^|\s)#([^\s#]*)\s?$/)
  return match ? { query: text.slice(0, match.index).trimEnd(), tag: match[1] } : { query: text, tag: null }
}

export function BookmarkSearch({
  query,
  tags,
  options,
  onChange,
  count,
  semanticEnabled,
  semanticStatus,
  semanticMessage,
  onSemanticSearch,
  onTextSearch
}) {
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()
  const [draft, setDraft] = useState(null)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const signature = JSON.stringify([query, tags])
  const text = draft?.signature === signature ? draft.text : query
  const token = splitInput(text)
  const candidates =
    token.tag === null
      ? []
      : options
          .filter(
            ({ tag, count }) =>
              count > 0 && !tags.includes(tag) && tag.toLocaleLowerCase().includes(token.tag.toLocaleLowerCase())
          )
          .slice(0, 30)
  const open = focused && !dismissed && token.tag !== null
  const index = Math.min(active, Math.max(0, candidates.length - 1))

  useEffect(() => {
    if (open) listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, index])

  const selectTag = (tag) => {
    const nextTags = tags.includes(tag) ? tags : [...tags, tag]
    const nextText = token.query ? token.query + ' ' : ''
    setDraft({ signature: JSON.stringify([token.query, nextTags]), text: nextText })
    onChange({ query: token.query, tags: nextTags })
    setDismissed(false)
    setActive(0)
    inputRef.current?.focus()
  }
  const removeTag = (tag) => {
    const nextTags = tags.filter((t) => t !== tag)
    setDraft({ signature: JSON.stringify([query, nextTags]), text })
    onChange({ tags: nextTags })
    inputRef.current?.focus()
  }
  const handleInput = (value, composing) => {
    const next = splitInput(value)
    setDraft({ signature: JSON.stringify([next.query, tags]), text: value })
    onChange({ query: next.query }, true)
    setDismissed(false)
    setActive(0)
    if (!composing && /\s$/.test(value) && next.tag) {
      const exact = options.find(
        ({ tag, count }) => count > 0 && tag.toLocaleLowerCase() === next.tag.toLocaleLowerCase()
      )
      if (exact) {
        const nextTags = [...new Set([...tags, exact.tag])]
        setDraft({ signature: JSON.stringify([next.query, nextTags]), text: next.query ? next.query + ' ' : '' })
        onChange({ query: next.query, tags: nextTags })
      }
    }
  }

  return (
    <div
      className="relative mb-6"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <div className="flex min-h-12 items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-shadow focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-gray-100">
        <LuSearch aria-hidden="true" className="mt-1 shrink-0 text-gray-400" size={18} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="group flex max-w-full items-center gap-0.5 rounded-md bg-gray-100 pl-2 text-sm text-gray-700"
            >
              <span className="min-w-0 break-all">
                <span className="text-gray-400">#</span>
                {tag}
              </span>
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-800 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <LuX size={13} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search bookmarks"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && candidates.length ? `${listId}-${index}` : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            enterKeyHint="search"
            placeholder={tags.length ? 'Search or add #tag…' : 'Search bookmarks or type # for tags…'}
            value={text}
            onChange={(event) => handleInput(event.target.value, event.nativeEvent.isComposing)}
            onFocus={() => {
              setFocused(true)
              setDismissed(false)
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return
              if (event.key === 'Escape') {
                setDismissed(true)
                event.preventDefault()
              } else if (open && candidates.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault()
                setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length)
              } else if (open && candidates[index] && (event.key === 'Enter' || event.key === 'Tab')) {
                event.preventDefault()
                selectTag(candidates[index].tag)
              } else if (event.key === 'Enter' && token.tag === null) {
                event.preventDefault()
                onSemanticSearch?.()
              } else if (event.key === 'Backspace' && !text && tags.length) {
                event.preventDefault()
                removeTag(tags.at(-1))
              }
            }}
            className="h-7 min-w-24 flex-1 basis-36 bg-transparent text-base outline-none placeholder:text-gray-400 sm:text-sm"
          />
        </div>
        {semanticEnabled && query.trim().length >= 2 && token.tag === null && (
          <button
            type="button"
            aria-label="Search with AI"
            title="Search with AI (Enter)"
            onClick={onSemanticSearch}
            disabled={semanticStatus === 'loading'}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:cursor-wait"
          >
            {semanticStatus === 'loading' ? (
              <LuLoaderCircle size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <LuArrowUp size={15} />
            )}
          </button>
        )}
      </div>
      {semanticEnabled && (
        <div className="mt-2 flex min-h-4 items-start justify-between gap-2 text-xs text-gray-500">
          <span role="status" aria-live="polite">
            {semanticStatus === 'loading'
              ? 'Finding matching bookmarks…'
              : semanticStatus === 'success'
                ? `${count} AI ${count === 1 ? 'match' : 'matches'}`
                : semanticStatus === 'error'
                  ? semanticMessage
                  : 'Enter for AI search · # for tags'}
          </span>
          {semanticStatus === 'success' && (
            <button
              type="button"
              className="shrink-0 underline underline-offset-2 hover:text-gray-900"
              onClick={onTextSearch}
            >
              Use text search
            </button>
          )}
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {count} bookmarks
      </span>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          <div className="px-2.5 py-1.5 text-xs text-gray-400">Tags</div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Tag suggestions"
            className="max-h-60 overflow-y-auto overscroll-contain"
          >
            {candidates.map(({ tag, count }, optionIndex) => (
              <div
                key={tag}
                id={`${listId}-${optionIndex}`}
                role="option"
                aria-selected={index === optionIndex}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => selectTag(tag)}
                onPointerMove={() => setActive(optionIndex)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${index === optionIndex ? 'bg-gray-100 text-gray-950' : 'text-gray-600'}`}
              >
                <LuHash size={14} className="shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 break-all">{tag}</span>
                <span className="text-xs text-gray-400 tabular-nums">{count}</span>
              </div>
            ))}
            {!candidates.length && (
              <div
                role="option"
                aria-disabled="true"
                aria-selected="false"
                className="px-2.5 py-3 text-sm text-gray-500"
              >
                No matching tags
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
