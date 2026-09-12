'use client'

import { gsap } from 'gsap'
import Markdown from 'markdown-to-jsx'
import NextLink from 'next/link'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuBookOpen, LuRotateCw } from 'react-icons/lu'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

import styles from './note-reader.module.css'

function followCard(event, id, onNavigate) {
  if (
    !onNavigate ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  onNavigate(id)
}

export function NoteMarkdown({ children, noteIds = new Set(), onNavigate }) {
  return (
    <Markdown
      className={styles.markdown}
      options={{
        disableParsingRawHTML: true,
        forceBlock: true,
        overrides: {
          a: ({ href = '', children }) => {
            const match = /^\/cards\/(\d{14})(?:[?#].*)?$/.exec(href)
            if (match) {
              const id = match[1]
              return noteIds.has(id) ? (
                <NextLink href={`/cards/${id}`} onClick={(event) => followCard(event, id, onNavigate)}>
                  {children}
                </NextLink>
              ) : (
                <span className={styles.unavailable} aria-disabled="true" title="这张卡片尚未发布">
                  {children}
                  <small>未发布</small>
                </span>
              )
            }
            if (/^https?:\/\//i.test(href)) {
              try {
                const url = new URL(href)
                if (url.hostname && !url.username && !url.password) {
                  return (
                    <a href={url.href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  )
                }
              } catch {
                /* Invalid URLs are readable text. */
              }
            }
            return <span>{children}</span>
          },
          img: ({ alt }) => <span className={styles.imageDescription}>{alt || '图片'}</span>
        }
      }}
    >
      {children || ''}
    </Markdown>
  )
}

function Reader({ note, notes, onNavigate, headingRef, active }) {
  const [english, setEnglish] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const rotor = useRef(null)
  const front = useRef(null)
  const back = useRef(null)
  const gesture = useRef(null)
  const lastScroll = useRef(0)
  const navigating = useRef(false)
  const noteIds = useMemo(() => new Set(notes.map((item) => item.noteId)), [notes])

  useLayoutEffect(() => {
    const element = rotor.current
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const flip = gsap.to(element, {
      rotateY: english ? 180 : 0,
      duration: preference.matches ? 0 : 0.62,
      ease: 'power2.inOut',
      overwrite: 'auto'
    })
    const reduceMotion = () => {
      if (preference.matches) {
        flip.progress(1)
      }
    }
    preference.addEventListener('change', reduceMotion)
    return () => {
      // Killing preserves the current transform so a rapid reversal never snaps.
      flip.kill()
      preference.removeEventListener('change', reduceMotion)
    }
  }, [english])

  function surfaceClick(event) {
    if (
      !active ||
      event.defaultPrevented ||
      event.detail === 0 ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return
    if (
      !event.currentTarget.contains(event.target) ||
      event.target.closest(
        'a, button, input, textarea, select, [role="dialog"], [role="alertdialog"], [contenteditable], [aria-disabled="true"]'
      )
    )
      return
    const start = gesture.current
    if (
      !start ||
      start.moved ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6 ||
      performance.now() - lastScroll.current < 220
    )
      return
    if (window.getSelection()?.toString()) return
    setEnglish((value) => !value)
  }

  function navigate(id) {
    navigating.current = true
    setSourcesOpen(false)
    onNavigate?.(id)
  }

  return (
    <article
      className={styles.reader}
      aria-label={note.title}
      aria-hidden={!active}
      inert={!active}
      onClick={surfaceClick}
      onPointerDown={(event) => {
        gesture.current = { x: event.clientX, y: event.clientY, moved: false }
      }}
      onPointerMove={(event) => {
        if (gesture.current && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 6)
          gesture.current.moved = true
      }}
      onPointerCancel={() => {
        if (gesture.current) gesture.current.moved = true
      }}
      onScrollCapture={() => {
        lastScroll.current = performance.now()
      }}
      onWheel={() => {
        lastScroll.current = performance.now()
      }}
    >
      <header className={styles.header}>
        <span className={styles.identity}>{note.noteId}</span>
        <button
          type="button"
          className={styles.flipButton}
          data-card-interactive="true"
          aria-label={english ? '翻到中文' : 'Flip to English'}
          aria-pressed={english}
          onClick={() => setEnglish((value) => !value)}
        >
          <LuRotateCw size={14} aria-hidden="true" />
          <span>{english ? 'English' : '中文'}</span>
        </button>
      </header>
      <div className={styles.perspective}>
        <div className={styles.rotor} ref={rotor}>
          <section
            className={styles.face}
            ref={front}
            data-reader-scroll="true"
            tabIndex={english ? -1 : 0}
            aria-label="中文正文"
            aria-hidden={english}
            inert={english}
            lang="zh-CN"
          >
            <h2 className={styles.title} ref={!english ? headingRef : undefined} tabIndex={-1}>
              {note.title}
            </h2>
            <NoteMarkdown noteIds={noteIds} onNavigate={onNavigate ? navigate : undefined}>
              {note.bodyZh}
            </NoteMarkdown>
          </section>
          <section
            className={`${styles.face} ${styles.back}`}
            ref={back}
            data-reader-scroll="true"
            tabIndex={!english ? -1 : 0}
            aria-label="English body"
            aria-hidden={!english}
            inert={!english}
            lang="en"
          >
            <h2 className={styles.title} ref={english ? headingRef : undefined} tabIndex={-1}>
              {note.titleEn || note.title}
            </h2>
            {note.bodyEn ? (
              <NoteMarkdown noteIds={noteIds} onNavigate={onNavigate ? navigate : undefined}>
                {note.bodyEn}
              </NoteMarkdown>
            ) : (
              <p className={styles.quiet}>
                这张卡片还没有英文版本。
                <br />
                An English version is not available yet.
              </p>
            )}
          </section>
        </div>
      </div>
      <footer className={styles.footer}>
        <div className={styles.tags}>
          {(note.tags || []).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <Dialog
          open={sourcesOpen}
          onOpenChange={(open) => {
            navigating.current = false
            setSourcesOpen(open)
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className={styles.sourceButton}
              data-card-interactive="true"
              aria-label={`查看来源：${note.title}`}
              title="查看来源"
            >
              <LuBookOpen size={17} aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent
            className={`max-h-[80dvh] overflow-y-auto sm:max-w-xl ${styles.sourceDialog}`}
            onCloseAutoFocus={(event) => {
              if (navigating.current) event.preventDefault()
            }}
          >
            <DialogHeader>
              <DialogTitle>卡片来源</DialogTitle>
              <DialogDescription>{note.title}</DialogDescription>
            </DialogHeader>
            {note.sources ? (
              <NoteMarkdown noteIds={noteIds} onNavigate={onNavigate ? navigate : undefined}>
                {note.sources}
              </NoteMarkdown>
            ) : (
              <p className={styles.quiet}>这张卡片暂未记录来源。</p>
            )}
          </DialogContent>
        </Dialog>
      </footer>
    </article>
  )
}

export function NoteReader({ note, notes = [], onNavigate, active = true }) {
  const headingRef = useRef(null)
  function navigate(id) {
    onNavigate(id)
    // Continue keyboard reading at the new card after the workspace updates.
    window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }
  return (
    <Reader
      key={`${note.noteId}:${active}`}
      active={active}
      note={note}
      notes={notes}
      headingRef={headingRef}
      onNavigate={onNavigate ? navigate : undefined}
    />
  )
}

export default NoteReader
