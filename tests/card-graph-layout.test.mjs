import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVisibleCardGraph,
  cardEdgePath,
  fitGraphToViewport,
  graphDotCenter,
  layoutCardGraph,
  zoomGraphAt
} from '../src/lib/card-graph-layout.js'

const notes = [
  { noteId: 'A', linkedNoteIds: ['B', 'C', 'B', 'missing'], tags: ['first'] },
  { noteId: 'B', linkedNoteIds: ['D', 'C'], tags: ['second'] },
  { noteId: 'C', linkedNoteIds: ['A', 'D'], tags: ['third'] },
  { noteId: 'D', linkedNoteIds: ['A', 'D'], tags: [] }
]

test('visible graph uses minimum distance across boxes and keeps genuine cycle/cross edges', () => {
  const graph = buildVisibleCardGraph(notes, 'A', 2)
  assert.deepEqual(
    graph.nodes.map(({ id, depth }) => [id, depth]),
    [
      ['A', 0],
      ['B', 1],
      ['C', 1],
      ['D', 2]
    ]
  )
  assert.deepEqual(
    graph.edges.map(({ source, target }) => `${source}->${target}`),
    ['A->B', 'A->C', 'B->C', 'B->D', 'C->A', 'C->D', 'D->A', 'D->D']
  )
  const shallow = buildVisibleCardGraph(notes, 'A', 1)
  assert.deepEqual(
    shallow.edges.map(({ source, target }) => `${source}->${target}`),
    ['A->B', 'A->C', 'B->C', 'C->A']
  )
  assert.equal(buildVisibleCardGraph(notes, 'A', 50).nodes.length, 4)
})

test('empty and unknown roots remain empty; root-only level and invalid levels are explicit', () => {
  assert.deepEqual(layoutCardGraph([], 'A', 2), { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } })
  assert.deepEqual(buildVisibleCardGraph(notes, 'missing', 2), { nodes: [], edges: [] })
  assert.deepEqual(
    buildVisibleCardGraph(notes, 'A', 0).nodes.map(({ id }) => id),
    ['A']
  )
  assert.throws(() => layoutCardGraph(notes, 'A', -1), RangeError)
  assert.throws(() => layoutCardGraph(notes, 'A', 1.2), RangeError)
})

test('dense fanout remains deterministic and collision-free with all cards inside finite bounds', () => {
  const ids = Array.from({ length: 120 }, (_, index) => `n${String(index).padStart(3, '0')}`)
  const dense = [
    { noteId: 'root', linkedNoteIds: ids },
    ...ids.map((id, index) => ({ noteId: id, linkedNoteIds: index < 60 ? [`leaf${index}`] : ['root'] })),
    ...ids.slice(0, 60).map((_, index) => ({ noteId: `leaf${index}`, linkedNoteIds: [] }))
  ]
  const graph = layoutCardGraph(dense, 'root', 2)
  assert.equal(graph.nodes.length, 181)
  assert.deepEqual(graph, layoutCardGraph([...dense].reverse(), 'root', 2))
  for (const [index, node] of graph.nodes.entries()) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y))
    assert.ok(node.x - node.width / 2 >= graph.bounds.x)
    assert.ok(node.y - node.height / 2 >= graph.bounds.y)
    assert.ok(node.x + node.width / 2 <= graph.bounds.x + graph.bounds.width)
    assert.ok(node.y + node.height / 2 <= graph.bounds.y + graph.bounds.height)
    for (const other of graph.nodes.slice(index + 1)) {
      const overlapsX = Math.abs(node.x - other.x) < (node.width + other.width) / 2
      const overlapsY = Math.abs(node.y - other.y) < (node.height + other.height) / 2
      assert.ok(!(overlapsX && overlapsY), `${node.id} collides with ${other.id}`)
    }
  }
})

test('fit includes controls clearance for mobile and large graphs', () => {
  const graph = layoutCardGraph(notes, 'A', 2)
  const inset = { top: 64, right: 28, bottom: 72, left: 28 }
  for (const size of [
    { width: 360, height: 600 },
    { width: 1100, height: 700 }
  ]) {
    const camera = fitGraphToViewport(graph.bounds, size, inset)
    assert.ok(camera.scale > 0 && camera.scale <= 1)
    assert.ok(graph.bounds.x * camera.scale + camera.x >= inset.left - 1e-6)
    assert.ok(graph.bounds.y * camera.scale + camera.y >= inset.top - 1e-6)
    assert.ok((graph.bounds.x + graph.bounds.width) * camera.scale + camera.x <= size.width - inset.right + 1e-6)
    assert.ok((graph.bounds.y + graph.bounds.height) * camera.scale + camera.y <= size.height - inset.bottom + 1e-6)
  }
  const empty = fitGraphToViewport({ x: 0, y: 0, width: 0, height: 0 }, { width: 0, height: 0 })
  assert.ok(Object.values(empty).every(Number.isFinite))
})

test('zoom preserves the focal world point and inverse zoom restores camera', () => {
  const camera = { x: 153, y: -80, scale: 0.6 }
  const focal = { x: 440, y: 270 }
  const zoomed = zoomGraphAt(camera, focal, 1.1)
  assert.ok(Math.abs((focal.x - camera.x) / camera.scale - (focal.x - zoomed.x) / zoomed.scale) < 1e-9)
  assert.ok(Math.abs((focal.y - camera.y) / camera.scale - (focal.y - zoomed.y) / zoomed.scale) < 1e-9)
  const restored = zoomGraphAt(zoomed, focal, camera.scale)
  assert.ok(Math.abs(restored.x - camera.x) < 1e-9 && Math.abs(restored.y - camera.y) < 1e-9)
})

test('edge paths meet circular point boundaries, with separate reciprocal curves and self loops', () => {
  const a = { id: 'A', x: 0, y: 0, depth: 0 }
  const b = { id: 'B', x: 172, y: 106, depth: 1 }
  const forward = cardEdgePath(a, b)
  const reverse = cardEdgePath(b, a)
  const numbers = forward.match(/-?\d+(?:\.\d+)?/g).map(Number)
  const from = graphDotCenter(a)
  const to = graphDotCenter(b)
  assert.ok(Math.abs(Math.hypot(numbers[0] - from.x, numbers[1] - from.y) - 7) < 1e-9)
  assert.ok(Math.abs(Math.hypot(numbers[4] - to.x, numbers[5] - to.y) - 6.5) < 1e-9)
  const reverseNumbers = reverse.match(/-?\d+(?:\.\d+)?/g).map(Number)
  assert.notDeepEqual(numbers.slice(2, 4), reverseNumbers.slice(2, 4))
  const loop = cardEdgePath(a, a)
  assert.ok(loop.includes(' C '))
  assert.ok(![forward, reverse, loop].some((path) => /NaN|undefined/.test(path)))
  const graph = layoutCardGraph([{ noteId: 'A', linkedNoteIds: ['A'] }], 'A', 1)
  assert.ok(graph.bounds.y <= graphDotCenter(a).y - 38)
})

test('compact point layouts preserve retained positions as Level expands', () => {
  const shallow = layoutCardGraph(notes, 'A', 1)
  const expanded = layoutCardGraph(notes, 'A', 2)
  for (const node of shallow.nodes) {
    const retained = expanded.nodes.find((item) => item.id === node.id)
    assert.deepEqual([node.x, node.y], [retained.x, retained.y])
  }
  const seven = [
    { noteId: 'root', linkedNoteIds: ['1', '2', '3', '4', '5', '6'] },
    ...['1', '2', '3', '4', '5', '6'].map((noteId) => ({ noteId, linkedNoteIds: [] }))
  ]
  const graph = layoutCardGraph(seven, 'root', 1)
  assert.ok(graph.bounds.width < 500 && graph.bounds.height < 300)
  const mobile = fitGraphToViewport(graph.bounds, { width: 390, height: 600 }, 20)
  assert.ok(mobile.scale > 0.7)
})
