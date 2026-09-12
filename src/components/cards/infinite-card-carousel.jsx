'use client'

import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu'

import { Button } from '@/components/ui/button'

import styles from './infinite-card-carousel.module.css'
import { NoteReader } from './note-reader'

gsap.registerPlugin(Draggable)

const modulo = (value, length) => ((value % length) + length) % length

export function InfiniteCardCarousel({ notes, allNotes, selectedId, onSelectNote, onNavigate, drawRequest = 0 }) {
  const count = notes.length === 1 ? 1 : notes.length * Math.ceil(7 / Math.max(1, notes.length))
  const slots = useMemo(() => Array.from({ length: count }, (_, index) => notes[index % notes.length]), [notes, count])
  const firstIndex = Math.max(
    0,
    notes.findIndex((note) => note.noteId === selectedId)
  )
  const [activeSlot, setActiveSlot] = useState(firstIndex)
  const [moving, setMoving] = useState(false)
  const stage = useRef(null)
  const elements = useRef([])
  const api = useRef(null)
  const callbacks = useRef({ onSelectNote })
  const suppressClick = useRef(false)
  useLayoutEffect(() => {
    callbacks.current = { onSelectNote }
  }, [onSelectNote])

  useLayoutEffect(() => {
    if (!count || !stage.current) return
    const viewport = stage.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const playhead = { value: firstIndex }
    let destination = firstIndex
    let spacing = 1
    let pressPosition = firstIndex
    let pressX = 0
    let ignoredPress = false
    let dragged = false
    let wheelAt = 0
    let alive = true
    const proxy = document.createElement('div')
    function paint() {
      for (let index = 0; index < count; index++) {
        const element = elements.current[index]
        if (!element) continue
        const distance = count === 1 ? 0 : gsap.utils.wrap(-count / 2, count / 2, index - playhead.value)
        const absolute = Math.abs(distance)
        gsap.set(element, {
          x: distance * spacing,
          y: absolute * 15,
          scale: Math.max(0.48, 1 - absolute * 0.21),
          rotationY: distance * -5,
          opacity: Math.max(0, 1 - absolute * 0.37),
          zIndex: Math.round(100 - absolute * 15),
          visibility: absolute > 2.7 ? 'hidden' : 'visible'
        })
      }
    }
    function finish() {
      if (!alive) return
      const slot = modulo(Math.round(destination), count)
      playhead.value = slot
      destination = slot
      paint()
      setActiveSlot(slot)
      setMoving(false)
      callbacks.current.onSelectNote(slots[slot].noteId)
    }
    const scrub = gsap.to(playhead, {
      value: firstIndex,
      duration: 0.58,
      ease: 'power3.out',
      paused: true,
      onUpdate: paint,
      onComplete: finish
    })
    function move(target) {
      if (count < 2) return
      destination = target
      setMoving(true)
      if (reduced.matches) {
        scrub.pause()
        playhead.value = target
        finish()
        return
      }
      scrub.vars.value = target
      scrub.invalidate().restart()
    }
    function select(id, redraw = false) {
      const noteIndex = notes.findIndex((note) => note.noteId === id)
      if (noteIndex < 0) return
      const period = notes.length
      const delta = gsap.utils.wrap(-period / 2, period / 2, noteIndex - destination)
      if (Math.abs(delta) > 0.001) move(destination + delta)
      else if (redraw && notes.length > 1) move(destination + period)
    }
    function resize() {
      const width = viewport.clientWidth
      const cardWidth = Math.min(460, width * (width < 500 ? 0.8 : 0.69))
      viewport.style.setProperty('--carousel-card-width', `${cardWidth}px`)
      spacing = cardWidth * 0.77
      paint()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    resize()
    const [drag] = Draggable.create(proxy, {
      type: 'x',
      trigger: viewport,
      allowEventDefault: true,
      allowNativeTouchScrolling: true,
      dragClickables: false,
      minimumMovement: 9,
      onPress() {
        const event = this.pointerEvent
        const touch =
          event?.pointerType === 'touch' || Boolean(event?.touches?.length) || event?.type?.startsWith('touch')
        dragged = false
        ignoredPress = Boolean(
          event?.target?.closest(
            '[data-card-interactive], a, button:not([data-clickable="false"]), input, textarea, select'
          ) ||
            (!touch && event?.target?.closest('[data-reader-scroll]'))
        )
        if (ignoredPress || count < 2) {
          this.endDrag()
          viewport.style.userSelect = 'text'
          viewport.onselectstart = null
          return
        }
        scrub.pause()
        pressPosition = playhead.value
        pressX = this.x
      },
      onDragStart() {
        if (!ignoredPress && count > 1) {
          dragged = true
          setMoving(true)
          suppressClick.current = true
        }
      },
      onDrag() {
        if (!ignoredPress && count > 1) {
          playhead.value = pressPosition - (this.x - pressX) / spacing
          paint()
        }
      },
      onRelease() {
        if (ignoredPress || count < 2) return
        if (dragged) move(Math.round(playhead.value))
        else if (Math.abs(playhead.value - Math.round(playhead.value)) > 0.01) move(Math.round(playhead.value))
      }
    })
    // Draggable's allowEventDefault sets inline `manipulation` on its trigger and descendants.
    // The body is itself a scrolling ancestor, so it also needs pan-y (not only the outer stage).
    viewport.style.touchAction = 'pan-y'
    viewport.querySelectorAll('[data-reader-scroll]').forEach((body) => {
      body.style.touchAction = 'pan-y'
    })
    function wheel(event) {
      if (count < 2 || event.target.closest('[data-carousel-reader], button:not([data-clickable="false"]), a, input'))
        return
      if (Math.abs(event.deltaX) + Math.abs(event.deltaY) < 4) return
      event.preventDefault()
      const now = performance.now()
      if (now - wheelAt < 260) return
      wheelAt = now
      move(destination + Math.sign(Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY))
    }
    function mediaChange() {
      if (reduced.matches && scrub.isActive()) scrub.progress(1)
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    reduced.addEventListener('change', mediaChange)
    api.current = {
      next: (direction) => move(destination + direction),
      center: (index) => move(destination + gsap.utils.wrap(-count / 2, count / 2, index - destination)),
      select
    }
    return () => {
      alive = false
      scrub.kill()
      drag.kill()
      observer.disconnect()
      reduced.removeEventListener('change', mediaChange)
      viewport.removeEventListener('wheel', wheel)
      api.current = null
    }
    // The parent keys the carousel by box, so a new collection starts at its selected card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, slots, count])

  const lastDraw = useRef(drawRequest)
  useLayoutEffect(() => {
    api.current?.select(selectedId, lastDraw.current !== drawRequest)
    lastDraw.current = drawRequest
  }, [selectedId, drawRequest])

  if (!notes.length) return <div className={styles.empty}>暂无已发布的卡片。</div>
  const activeNote = slots[activeSlot] || notes[0]
  const position = notes.findIndex((note) => note.noteId === activeNote.noteId)
  return (
    <section
      className={styles.carousel}
      aria-label="无限卡片轮播"
      aria-roledescription="carousel"
      data-moving={moving ? 'true' : 'false'}
    >
      <div
        ref={stage}
        className={styles.stage}
        tabIndex={0}
        aria-label="卡片舞台。左右方向键翻阅，拖动或在空白处滚动切换。"
        onPointerDownCapture={() => {
          suppressClick.current = false
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
          }
        }}
        onKeyDown={(event) => {
          if (event.target.closest('button,a,input,[data-reader-scroll]')) return
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            api.current?.next(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
      >
        {slots.map((note, index) => {
          const active = index === activeSlot
          return (
            <div
              key={index}
              ref={(element) => {
                elements.current[index] = element
              }}
              className={styles.slot}
              data-carousel-slot={index}
              data-active={active ? 'true' : 'false'}
              data-note-id={note.noteId}
              aria-hidden={!active}
            >
              {active ? (
                <div className={styles.reader} data-carousel-reader inert={moving}>
                  <NoteReader key={note.noteId} note={note} notes={allNotes} onNavigate={onNavigate} active />
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.preview}
                  data-clickable="false"
                  tabIndex={-1}
                  onClick={() => api.current?.center(index)}
                  aria-label={`切换到：${note.title}`}
                >
                  <span className={styles.previewId}>{note.noteId}</span>
                  <strong>{note.title}</strong>
                  <span className={styles.previewBody}>
                    {(note.bodyZh || '')
                      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
                      .replace(/[#*_`>]/g, '')
                      .slice(0, 240)}
                  </span>
                  <span className={styles.previewTag}>{note.tags.join(' · ')}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.controls}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={notes.length < 2}
          aria-label="上一张卡片"
          onClick={() => api.current?.next(-1)}
        >
          <LuArrowLeft size={18} />
        </Button>
        <span role="status" aria-live="polite">
          {position + 1}
          <span> / {notes.length}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={notes.length < 2}
          aria-label="下一张卡片"
          onClick={() => api.current?.next(1)}
        >
          <LuArrowRight size={18} />
        </Button>
      </div>
    </section>
  )
}
