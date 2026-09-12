export const GRAPH_NODE_WIDTH = 132
export const GRAPH_NODE_HEIGHT = 62
const COLUMN_GAP = 40
const ROW_GAP = 44

/** Outgoing breadth-first traversal; retain all real edges between the visible notes. */
export function buildVisibleCardGraph(notes, rootNoteId, level = 1) {
  if (!Number.isInteger(level) || level < 0) throw new RangeError('Level must be a non-negative integer')
  const byId = new Map(notes.map((note) => [note.noteId, note]))
  if (!byId.has(rootNoteId)) return { nodes: [], edges: [] }
  const nodes = [{ id: rootNoteId, note: byId.get(rootNoteId), depth: 0, parentId: null, side: 0 }]
  const visited = new Set([rootNoteId])
  let firstNeighbor = 0
  for (let cursor = 0; cursor < nodes.length; cursor++) {
    const source = nodes[cursor]
    if (source.depth >= level) continue
    for (const id of [...new Set(source.note.linkedNoteIds ?? [])].sort()) {
      if (!byId.has(id) || visited.has(id)) continue
      visited.add(id)
      const side = source.depth === 0 ? (firstNeighbor++ % 2 === 0 ? 1 : -1) : source.side
      nodes.push({ id, note: byId.get(id), depth: source.depth + 1, parentId: source.id, side })
    }
  }
  const edges = nodes.flatMap((source) =>
    [...new Set(source.note.linkedNoteIds ?? [])]
      .filter((id) => visited.has(id))
      .sort()
      .map((target) => ({ id: JSON.stringify([source.id, target]), source: source.id, target }))
  )
  return { nodes, edges }
}

/** Compact rings of reserved label cells keep every label collision-free and preserve existing positions on expansion. */
export function layoutCardGraph(notes, rootNoteId, level = 1) {
  const graph = buildVisibleCardGraph(notes, rootNoteId, level)
  const cells = [[0, 0]]
  for (let ring = 1; cells.length < graph.nodes.length; ring++) {
    cells.push([ring, 0], [-ring, 0], [0, -ring], [0, ring])
    for (let offset = 1; offset <= ring; offset++) {
      cells.push([ring, -offset], [-ring, offset], [-ring, -offset], [ring, offset])
      if (offset < ring) cells.push([offset, -ring], [-offset, ring], [-offset, -ring], [offset, ring])
    }
  }
  const nodes = graph.nodes.map((node, index) => ({
    ...node,
    x: cells[index][0] * (GRAPH_NODE_WIDTH + COLUMN_GAP),
    y: cells[index][1] * (GRAPH_NODE_HEIGHT + ROW_GAP),
    width: GRAPH_NODE_WIDTH,
    height: GRAPH_NODE_HEIGHT
  }))
  const bounds = getGraphBounds(nodes)
  for (const edge of graph.edges) {
    if (edge.source !== edge.target) continue
    const node = nodes.find((item) => item.id === edge.source)
    const top = Math.min(bounds.y, graphDotCenter(node).y - 38)
    bounds.height += bounds.y - top
    bounds.y = top
  }
  return { nodes, edges: graph.edges, bounds }
}

export function getGraphBounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 }
  const left = Math.min(...nodes.map((node) => node.x - node.width / 2))
  const top = Math.min(...nodes.map((node) => node.y - node.height / 2))
  const right = Math.max(...nodes.map((node) => node.x + node.width / 2))
  const bottom = Math.max(...nodes.map((node) => node.y + node.height / 2))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function fitGraphToViewport(bounds, viewport, padding = 64) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const inset = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding
  const usableWidth = Math.max(1, width - inset.left - inset.right)
  const usableHeight = Math.max(1, height - inset.top - inset.bottom)
  const scale = Math.min(1, usableWidth / Math.max(1, bounds.width), usableHeight / Math.max(1, bounds.height))
  return {
    x: inset.left + usableWidth / 2 - (bounds.x + bounds.width / 2) * scale,
    y: inset.top + usableHeight / 2 - (bounds.y + bounds.height / 2) * scale,
    scale
  }
}

/** Keeps the world point underneath a screen-space focal point stationary. */
export function zoomGraphAt(camera, focal, scale) {
  const ratio = scale / camera.scale
  return { x: focal.x - (focal.x - camera.x) * ratio, y: focal.y - (focal.y - camera.y) * ratio, scale }
}

/** The point sits above its two-line label, inside the reserved label cell. */
export function graphDotCenter(node) {
  return { x: node.x, y: node.y - GRAPH_NODE_HEIGHT / 2 + 9 }
}

/** Curves terminate on the circular point boundaries, including distinct reciprocal arrows. */
export function cardEdgePath(source, target) {
  const from = graphDotCenter(source)
  const to = graphDotCenter(target)
  const sourceRadius = source.depth === 0 ? 7 : 4.5
  const targetRadius = (target.depth === 0 ? 7 : 4.5) + 2
  if (source.id === target.id) {
    return `M ${from.x - 3} ${from.y - sourceRadius} C ${from.x - 38} ${from.y - 38}, ${from.x + 38} ${from.y - 38}, ${from.x + 3} ${from.y - targetRadius}`
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const ux = dx / distance
  const uy = dy / distance
  // A consistent normal yields distinct curves for reciprocal links.
  const bend = Math.min(32, distance * 0.12)
  const controlX = (from.x + to.x) / 2 - uy * bend
  const controlY = (from.y + to.y) / 2 + ux * bend
  const startLength = Math.hypot(controlX - from.x, controlY - from.y) || 1
  const endLength = Math.hypot(to.x - controlX, to.y - controlY) || 1
  const startX = from.x + ((controlX - from.x) / startLength) * sourceRadius
  const startY = from.y + ((controlY - from.y) / startLength) * sourceRadius
  const endX = to.x - ((to.x - controlX) / endLength) * targetRadius
  const endY = to.y - ((to.y - controlY) / endLength) * targetRadius
  return `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`
}
