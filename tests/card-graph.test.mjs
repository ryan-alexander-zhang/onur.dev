import assert from 'node:assert/strict'
import test from 'node:test'

import { drawRandomNote, getRelatedNotesByLevel, groupNotesByTag } from '../src/lib/card-graph.js'

const notes = [
  { noteId: 'A', tags: ['design', 'systems', 'design'], linkedNoteIds: ['A', 'B', 'B', 'unpublished'] },
  { noteId: 'B', tags: ['systems'], linkedNoteIds: ['C'] },
  { noteId: 'C', tags: ['reading'], linkedNoteIds: ['A'] }
]

test('multi-tag notes occur once in each box and drawing stays inside the selected box', () => {
  const boxes = groupNotesByTag(notes)
  assert.deepEqual(
    boxes.map(({ tag, notes }) => [tag, notes.map((note) => note.noteId)]),
    [
      ['design', ['A']],
      ['reading', ['C']],
      ['systems', ['A', 'B']]
    ]
  )
  const box = boxes.find((box) => box.tag === 'systems')
  assert.equal(drawRandomNote(box.notes, () => 0).noteId, 'A')
  assert.equal(drawRandomNote(box.notes, () => 0.999).noteId, 'B')
  assert.equal(drawRandomNote([]), null)
})

test('BFS crosses tag boundaries, terminates cycles, and excludes self and unpublished links', () => {
  assert.deepEqual(
    getRelatedNotesByLevel(notes, 'A', 20).map(({ level, notes }) => [level, notes.map((n) => n.noteId)]),
    [
      [1, ['B']],
      [2, ['C']]
    ]
  )
  assert.deepEqual(getRelatedNotesByLevel(notes, 'A', 0), [])
  assert.equal(getRelatedNotesByLevel(notes, 'A', 1).length, 1)
  assert.deepEqual(getRelatedNotesByLevel(notes, 'missing', 3), [])
  assert.throws(() => getRelatedNotesByLevel(notes, 'A', 1.5), RangeError)
  assert.throws(() => getRelatedNotesByLevel(notes, 'A', -1), RangeError)
})

test('shared targets occur only at their minimum distance, including flattened English links', () => {
  const graph = [
    { noteId: 'A', linkedNoteIds: ['B', 'C'] },
    { noteId: 'B', linkedNoteIds: ['C', 'D'] },
    { noteId: 'C', linkedNoteIds: ['D'] },
    { noteId: 'D', linkedNoteIds: [] }
  ]
  assert.deepEqual(
    getRelatedNotesByLevel(graph, 'A', 5).map(({ level, notes }) => [level, notes.map((n) => n.noteId)]),
    [
      [1, ['B', 'C']],
      [2, ['D']]
    ]
  )
})
