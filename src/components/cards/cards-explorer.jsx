'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuLayers, LuNetwork, LuShuffle } from 'react-icons/lu'

import { SideMenu } from '@/components/side-menu'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { drawRandomNote, groupNotesByTag } from '@/lib/card-graph'

import styles from './cards.module.css'
import { InfiniteCardCarousel } from './infinite-card-carousel'
import { RelationCanvas } from './relation-canvas'

const UNTAGGED = '__untagged__'
const label = (tag) => (tag === UNTAGGED ? '未分类' : tag)

export function CardsExplorer({ notes, initialNoteId, initialTag, initialView = 'cards', initialLevel = 1 }) {
  const boxes = useMemo(() => {
    const tagged = groupNotesByTag(notes)
    const untagged = notes.filter((note) => !note.tags.length)
    return untagged.length ? [...tagged, { tag: UNTAGGED, notes: untagged }] : tagged
  }, [notes])
  function resolveBox(noteId, preferredTag) {
    const preferred = boxes.find((box) => box.tag === preferredTag)
    if (preferred && (!noteId || preferred.notes.some((note) => note.noteId === noteId))) return preferred
    const note = notes.find((item) => item.noteId === noteId)
    if (!note) return preferred || boxes[0]
    return (
      boxes.find((box) => box.tag === (note?.tags[0] || UNTAGGED)) ||
      boxes.find((box) => box.notes.some((item) => item.noteId === noteId)) ||
      boxes[0]
    )
  }
  const firstBox = resolveBox(initialNoteId, initialTag)
  const [workspace, setWorkspace] = useState({
    tag: firstBox?.tag || null,
    selectedId: initialNoteId || firstBox?.notes[0]?.noteId || null,
    view: initialView === 'map' ? 'map' : 'cards',
    level: Math.max(1, Math.min(Math.max(1, notes.length - 1), Math.floor(Number(initialLevel)) || 1))
  })
  const [drawRequest, setDrawRequest] = useState(0)
  const current = useRef(workspace)
  useLayoutEffect(() => {
    current.current = workspace
  }, [workspace])
  const box = boxes.find((item) => item.tag === workspace.tag) || boxes[0]
  const selectedNote = notes.find((note) => note.noteId === workspace.selectedId) || box?.notes[0]

  function change(next, replace = false) {
    const value = { ...current.current, ...next }
    setWorkspace(value)
    current.current = value
    const query = new URLSearchParams()
    if (value.tag) query.set('tag', value.tag)
    if (value.view === 'map') {
      query.set('view', 'map')
      query.set('level', String(value.level))
    }
    const path = value.selectedId ? `/cards/${encodeURIComponent(value.selectedId)}?${query}` : '/cards'
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, cardsWorkspace: value }, '', path)
  }
  function navigate(id) {
    const target = resolveBox(id, current.current.tag)
    if (target && notes.some((note) => note.noteId === id)) change({ selectedId: id, tag: target.tag, view: 'cards' })
  }
  function chooseTag(tag) {
    const target = boxes.find((item) => item.tag === tag)
    if (target) change({ tag, selectedId: target.notes[0]?.noteId, view: 'cards' })
  }

  useEffect(() => {
    if (!window.history.state?.cardsWorkspace)
      window.history.replaceState(
        { ...window.history.state, cardsWorkspace: current.current },
        '',
        window.location.href
      )
    function restore(event) {
      const saved = event.state?.cardsWorkspace
      const query = new URLSearchParams(window.location.search)
      const match = /^\/cards\/([^/]+)$/.exec(window.location.pathname)
      let id
      try {
        id = saved?.selectedId || (match ? decodeURIComponent(match[1]) : null)
      } catch {
        id = null
      }
      const target = resolveBox(id, saved?.tag || query.get('tag'))
      const restored = {
        tag: target?.tag || null,
        selectedId: id || target?.notes[0]?.noteId || null,
        view: (saved?.view || query.get('view')) === 'map' ? 'map' : 'cards',
        level: Math.max(1, Number(saved?.level || query.get('level')) || 1)
      }
      current.current = restored
      setWorkspace(restored)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
    // resolveBox only depends on the current published collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, boxes])

  return (
    <div className={styles.shell}>
      <SideMenu title="Cards" isInner>
        <nav aria-label="卡片盒" className={styles.boxList}>
          {boxes.map((item) => (
            <button
              type="button"
              key={item.tag}
              className={`${styles.boxButton} ${box?.tag === item.tag ? styles.selectedBox : ''}`}
              aria-current={box?.tag === item.tag ? 'true' : undefined}
              onClick={() => chooseTag(item.tag)}
            >
              <LuLayers size={16} aria-hidden="true" />
              <span>{label(item.tag)}</span>
              <small>{item.notes.length}</small>
            </button>
          ))}
        </nav>
      </SideMenu>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.desktopTitle}>
            <h1>{box ? label(box.tag) : 'Cards'}</h1>
            {box && <span>{box.notes.length}</span>}
          </div>
          <div className={styles.mobileSelect}>
            {box && (
              <Select value={box.tag} onValueChange={chooseTag}>
                <SelectTrigger aria-label="选择卡片盒">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boxes.map((item) => (
                    <SelectItem value={item.tag} key={item.tag}>
                      {label(item.tag)} · {item.notes.length}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {selectedNote && (
            <div className={styles.actions}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="随机抽取一张卡片"
                title="随机抽取"
                onClick={() => {
                  const note = drawRandomNote(box.notes)
                  if (note) {
                    navigate(note.noteId)
                    setDrawRequest((value) => value + 1)
                  }
                }}
              >
                <LuShuffle size={16} />
              </Button>
              <Button
                type="button"
                variant={workspace.view === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={workspace.view === 'map'}
                onClick={() => change({ view: workspace.view === 'map' ? 'cards' : 'map' })}
              >
                <LuNetwork size={15} />
                <span>{workspace.view === 'map' ? 'Cards' : 'Map'}</span>
              </Button>
            </div>
          )}
        </header>
        {!box ? (
          <div className={styles.empty}>卡片盒正在整理中。已发布的永久笔记会出现在这里。</div>
        ) : workspace.view === 'map' && selectedNote ? (
          <div className={styles.mapPane}>
            <div className={styles.mapTools}>
              <span>{selectedNote.title}</span>
              <label>
                Level{' '}
                <input
                  type="number"
                  aria-label="关系图谱层级"
                  min="1"
                  max={Math.max(1, notes.length - 1)}
                  value={workspace.level}
                  onChange={(event) =>
                    change(
                      {
                        level: Math.max(
                          1,
                          Math.min(Math.max(1, notes.length - 1), Math.floor(Number(event.target.value)) || 1)
                        )
                      },
                      true
                    )
                  }
                />
              </label>
            </div>
            <RelationCanvas
              notes={notes}
              rootNoteId={selectedNote.noteId}
              selectedNoteId={selectedNote.noteId}
              level={workspace.level}
              onSelectNote={navigate}
            />
          </div>
        ) : (
          <InfiniteCardCarousel
            key={box.tag}
            notes={box.notes}
            allNotes={notes}
            selectedId={selectedNote?.noteId}
            onSelectNote={(id) => {
              if (current.current.selectedId !== id) change({ selectedId: id })
            }}
            onNavigate={navigate}
            drawRequest={drawRequest}
          />
        )}
      </div>
    </div>
  )
}
