'use client'

import { gsap } from 'gsap'
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuFocus, LuMaximize, LuMinus, LuPlus } from 'react-icons/lu'

import { cardEdgePath, fitGraphToViewport, layoutCardGraph, zoomGraphAt } from '@/lib/card-graph-layout'

import styles from './relation-canvas.module.css'

function fitCamera(graph, size) {
  const horizontal = size.width < 600 ? 20 : 48
  return fitGraphToViewport(graph.bounds, size, { top: 28, bottom: 64, left: horizontal, right: horizontal })
}

export function RelationCanvas({ notes, rootNoteId, level = 1, selectedNoteId, onSelectNote }) {
  const graph = useMemo(() => layoutCardGraph(notes, rootNoteId, level), [notes, rootNoteId, level])
  const [renderedGraph, setRenderedGraph] = useState(graph)
  const markerId = `card-arrow-${useId().replace(/:/g, '')}`
  const viewportRef = useRef(null)
  const worldRef = useRef(null)
  const zoomLabelRef = useRef(null)
  const nodeElements = useRef(new Map())
  const edgeElements = useRef(new Map())
  const positions = useRef(new Map())
  const graphRef = useRef(graph)
  const viewportSize = useRef({ width: 1, height: 1 })
  const camera = useRef({ x: 0, y: 0, scale: 1 })
  const cameraTween = useRef(null)
  const layoutTimeline = useRef(null)
  const manualView = useRef(false)
  const reducedMotion = useRef(false)

  const paintCamera = useCallback(() => {
    const { x, y, scale } = camera.current
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(scale * 100)}%`
  }, [])

  const moveCamera = useCallback(
    (next, animate = true) => {
      cameraTween.current?.kill()
      if (!animate || reducedMotion.current) {
        Object.assign(camera.current, next)
        paintCamera()
        return
      }
      cameraTween.current = gsap.to(camera.current, {
        ...next,
        duration: 0.65,
        ease: 'power3.inOut',
        onUpdate: paintCamera
      })
    },
    [paintCamera]
  )

  const fit = useCallback(() => {
    manualView.current = true
    moveCamera(fitCamera(graphRef.current, viewportSize.current))
  }, [moveCamera])

  const zoom = useCallback(
    (factor, focal) => {
      manualView.current = true
      const size = viewportSize.current
      const scale = Math.max(0.04, Math.min(2, camera.current.scale * factor))
      moveCamera(zoomGraphAt(camera.current, focal || { x: size.width / 2, y: size.height / 2 }, scale), false)
    },
    [moveCamera]
  )

  const centerSelected = useCallback(() => {
    const node = graphRef.current.nodes.find((item) => item.id === (selectedNoteId || rootNoteId))
    if (!node) return
    manualView.current = true
    const scale = Math.max(0.8, camera.current.scale)
    moveCamera({
      x: viewportSize.current.width / 2 - node.x * scale,
      y: viewportSize.current.height / 2 - node.y * scale,
      scale
    })
  }, [moveCamera, rootNoteId, selectedNoteId])

  const measureAvailableHeight = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const top = Math.max(0, viewport.getBoundingClientRect().top)
    const height = Math.max(320, Math.floor((window.visualViewport?.height || window.innerHeight) - top - 8))
    const value = `${height}px`
    if (viewport.style.getPropertyValue('--canvas-available-height') !== value)
      viewport.style.setProperty('--canvas-available-height', value)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = media.matches
    const updateMotion = () => {
      reducedMotion.current = media.matches
      if (media.matches) {
        layoutTimeline.current?.progress(1)
        cameraTween.current?.progress(1)
      }
    }
    media.addEventListener('change', updateMotion)
    measureAvailableHeight()
    window.addEventListener('resize', measureAvailableHeight)
    window.visualViewport?.addEventListener('resize', measureAvailableHeight)
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      viewportSize.current = { width, height }
      if (!manualView.current) moveCamera(fitCamera(graphRef.current, viewportSize.current), false)
    })
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureAvailableHeight)
      window.visualViewport?.removeEventListener('resize', measureAvailableHeight)
      media.removeEventListener('change', updateMotion)
      cameraTween.current?.kill()
    }
  }, [measureAvailableHeight, moveCamera])

  useLayoutEffect(() => {
    graphRef.current = graph
    measureAvailableHeight()
    setRenderedGraph((previous) => {
      const nodeIds = new Set(graph.nodes.map((node) => node.id))
      const edgeIds = new Set(graph.edges.map((edge) => edge.id))
      return {
        ...graph,
        nodes: [
          ...graph.nodes,
          ...previous.nodes.filter((node) => !nodeIds.has(node.id)).map((node) => ({ ...node, exiting: true }))
        ],
        edges: [
          ...graph.edges,
          ...previous.edges.filter((edge) => !edgeIds.has(edge.id)).map((edge) => ({ ...edge, exiting: true }))
        ]
      }
    })
    manualView.current = false
    moveCamera(fitCamera(graph, viewportSize.current))
  }, [graph, measureAvailableHeight, moveCamera])

  useLayoutEffect(() => {
    layoutTimeline.current?.kill()
    const newIds = new Set()
    const visibleIds = new Set(renderedGraph.nodes.map((node) => node.id))
    const targets = new Map(graphRef.current.nodes.map((node) => [node.id, node]))
    for (const node of renderedGraph.nodes) {
      if (!positions.current.has(node.id)) {
        const parent = positions.current.get(node.parentId) || positions.current.get(rootNoteId)
        positions.current.set(node.id, { x: parent?.x ?? node.x, y: parent?.y ?? node.y })
        newIds.add(node.id)
      }
    }
    for (const id of positions.current.keys()) {
      if (!visibleIds.has(id)) positions.current.delete(id)
    }
    const paint = () => {
      for (const node of renderedGraph.nodes) {
        const point = positions.current.get(node.id)
        const element = nodeElements.current.get(node.id)
        if (point && element)
          element.style.transform = `translate(${point.x - node.width / 2}px, ${point.y - node.height / 2}px)`
      }
      for (const edge of renderedGraph.edges) {
        const source = positions.current.get(edge.source)
        const target = positions.current.get(edge.target)
        if (source && target)
          edgeElements.current
            .get(edge.id)
            ?.setAttribute(
              'd',
              cardEdgePath(
                { ...source, id: edge.source, depth: edge.source === rootNoteId ? 0 : 1 },
                { ...target, id: edge.target, depth: edge.target === rootNoteId ? 0 : 1 }
              )
            )
      }
    }
    paint()
    const duration = reducedMotion.current ? 0 : 0.75
    const hasExits =
      renderedGraph.nodes.some((node) => node.exiting) || renderedGraph.edges.some((edge) => edge.exiting)
    const timeline = gsap.timeline({
      onUpdate: paint,
      onComplete: () => {
        if (hasExits && layoutTimeline.current === timeline) setRenderedGraph(graphRef.current)
      }
    })
    layoutTimeline.current = timeline
    for (const node of renderedGraph.nodes) {
      const target = node.exiting ? targets.get(node.parentId) || targets.get(rootNoteId) || node : node
      timeline.to(positions.current.get(node.id), { x: target.x, y: target.y, duration, ease: 'power3.inOut' }, 0)
      const element = nodeElements.current.get(node.id)
      if (node.exiting) {
        timeline.to(element, { opacity: 0, duration: duration * 0.7, ease: 'power2.in' }, 0)
      } else if (newIds.has(node.id)) {
        timeline.fromTo(
          element,
          { opacity: 0 },
          { opacity: 1, duration: duration * 0.8, ease: 'power2.out' },
          duration * 0.12
        )
      } else {
        timeline.to(element, { opacity: 1, duration: duration * 0.4 }, 0)
      }
    }
    for (const edge of renderedGraph.edges) {
      const element = edgeElements.current.get(edge.id)
      if (!element) continue
      if (edge.exiting) {
        timeline.to(element, { strokeDashoffset: 1, opacity: 0, duration: duration * 0.75, ease: 'power2.in' }, 0)
      } else if (element.dataset.drawn !== 'true') {
        element.dataset.drawn = 'true'
        timeline.fromTo(
          element,
          { strokeDashoffset: 1, opacity: 0 },
          { strokeDashoffset: 0, opacity: 1, duration: duration * 0.9, ease: 'power2.out' },
          duration * 0.15
        )
      } else {
        timeline.to(element, { strokeDashoffset: 0, opacity: 1, duration: duration * 0.65, ease: 'power2.out' }, 0)
      }
    }
    return () => timeline.kill()
  }, [renderedGraph, rootNoteId])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const pointers = new Map()
    let gesture = null
    const point = (event) => {
      const rect = viewport.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const startGesture = () => {
      const values = [...pointers.values()]
      if (!values.length) {
        gesture = null
        return
      }
      gesture = { camera: { ...camera.current }, origin: values[0] }
      if (values.length > 1) {
        gesture.distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y)
        gesture.midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 }
      }
    }
    const down = (event) => {
      if (event.button !== 0 || event.target.closest('button, a, input, [data-graph-control]')) return
      cameraTween.current?.kill()
      pointers.set(event.pointerId, point(event))
      viewport.setPointerCapture(event.pointerId)
      viewport.dataset.panning = 'true'
      manualView.current = true
      startGesture()
    }
    const move = (event) => {
      if (!pointers.has(event.pointerId) || !gesture) return
      pointers.set(event.pointerId, point(event))
      const values = [...pointers.values()]
      if (values.length > 1 && gesture.midpoint) {
        const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y)
        const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 }
        const scale = Math.max(0.04, Math.min(2, (gesture.camera.scale * distance) / Math.max(1, gesture.distance)))
        const next = zoomGraphAt(gesture.camera, gesture.midpoint, scale)
        moveCamera(
          { ...next, x: next.x + midpoint.x - gesture.midpoint.x, y: next.y + midpoint.y - gesture.midpoint.y },
          false
        )
      } else {
        moveCamera(
          {
            ...gesture.camera,
            x: gesture.camera.x + values[0].x - gesture.origin.x,
            y: gesture.camera.y + values[0].y - gesture.origin.y
          },
          false
        )
      }
    }
    const up = (event) => {
      pointers.delete(event.pointerId)
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
      if (!pointers.size) delete viewport.dataset.panning
      startGesture()
    }
    const wheel = (event) => {
      if (event.target.closest('[data-graph-control]')) return
      event.preventDefault()
      zoom(Math.exp(-event.deltaY * 0.002), point(event))
    }
    const key = (event) => {
      if (event.target !== viewport) return
      if (event.key === '+' || event.key === '=') zoom(1.2)
      else if (event.key === '-') zoom(1 / 1.2)
      else if (event.key === '0' || event.key.toLowerCase() === 'f') fit()
      else if (event.key.toLowerCase() === 'c') centerSelected()
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        manualView.current = true
        moveCamera(
          {
            ...camera.current,
            x: camera.current.x + (event.key === 'ArrowLeft' ? 70 : event.key === 'ArrowRight' ? -70 : 0),
            y: camera.current.y + (event.key === 'ArrowUp' ? 70 : event.key === 'ArrowDown' ? -70 : 0)
          },
          false
        )
      } else return
      event.preventDefault()
    }
    viewport.addEventListener('pointerdown', down)
    viewport.addEventListener('pointermove', move)
    viewport.addEventListener('pointerup', up)
    viewport.addEventListener('pointercancel', up)
    viewport.addEventListener('lostpointercapture', up)
    viewport.addEventListener('wheel', wheel, { passive: false })
    viewport.addEventListener('keydown', key)
    return () => {
      viewport.removeEventListener('pointerdown', down)
      viewport.removeEventListener('pointermove', move)
      viewport.removeEventListener('pointerup', up)
      viewport.removeEventListener('pointercancel', up)
      viewport.removeEventListener('lostpointercapture', up)
      viewport.removeEventListener('wheel', wheel)
      viewport.removeEventListener('keydown', key)
      for (const id of pointers.keys()) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id)
    }
  }, [centerSelected, fit, moveCamera, zoom])

  return (
    <section className={styles.canvas} aria-label="卡片关系画布">
      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-label="关系图。拖动画布平移，滚轮缩放。键盘方向键平移，加减键缩放，F 适应画布，C 聚焦卡片。"
      >
        <div ref={worldRef} className={styles.world}>
          <svg className={styles.edges} width="1" height="1" aria-hidden="true">
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {renderedGraph.edges.map((edge) => (
              <path
                key={edge.id}
                ref={(element) => {
                  if (element) edgeElements.current.set(edge.id, element)
                  else edgeElements.current.delete(edge.id)
                }}
                className={edge.source === rootNoteId || edge.target === rootNoteId ? styles.rootEdge : styles.edge}
                data-source={edge.source}
                data-target={edge.target}
                d=""
                fill="none"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset="0"
                markerEnd={`url(#${markerId})`}
              />
            ))}
          </svg>
          {renderedGraph.nodes.map((node) => (
            <button
              key={node.id}
              ref={(element) => {
                if (element) nodeElements.current.set(node.id, element)
                else nodeElements.current.delete(node.id)
              }}
              type="button"
              className={`${styles.node} ${node.depth === 0 ? styles.rootNode : ''} ${node.id === selectedNoteId ? styles.selectedNode : ''}`}
              data-note-id={node.id}
              data-flip-id={`card-${node.id}`}
              data-depth={node.depth}
              data-exiting={node.exiting || undefined}
              disabled={node.exiting}
              tabIndex={node.exiting ? -1 : 0}
              aria-hidden={node.exiting || undefined}
              aria-label={`${node.note.title || node.note.titleEn || node.id}，${node.depth === 0 ? '当前起点' : `${node.depth} 跳关联`}，打开卡片`}
              aria-pressed={node.id === selectedNoteId}
              onClick={() => onSelectNote(node.id)}
              style={{ width: node.width, height: node.height }}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.nodeTitle}>{node.note.title || node.note.titleEn || node.id}</span>
            </button>
          ))}
        </div>
        {!graph.nodes.length && <p className={styles.empty}>暂时没有可展示的关联卡片。</p>}
      </div>
      <div className={styles.controls} data-graph-control>
        <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="缩小关系图" title="缩小 (−)">
          <LuMinus size={16} />
        </button>
        <span ref={zoomLabelRef} className={styles.zoomLabel} aria-hidden="true">
          100%
        </span>
        <button type="button" onClick={() => zoom(1.2)} aria-label="放大关系图" title="放大 (+)">
          <LuPlus size={16} />
        </button>
        <span className={styles.controlDivider} />
        <button type="button" onClick={fit} aria-label="适应全部卡片" title="适应全部卡片 (F)">
          <LuMaximize size={16} />
        </button>
        <button type="button" onClick={centerSelected} aria-label="聚焦当前卡片" title="聚焦当前卡片 (C)">
          <LuFocus size={16} />
        </button>
      </div>
    </section>
  )
}

export default RelationCanvas
