/** A note can belong to multiple boxes. Untagged notes remain available by ID. */
export function groupNotesByTag(notes) {
  const boxes = new Map()
  for (const note of notes) {
    for (const tag of new Set(note.tags ?? [])) {
      if (!tag) continue
      if (!boxes.has(tag)) boxes.set(tag, [])
      if (!boxes.get(tag).some((item) => item.noteId === note.noteId)) boxes.get(tag).push(note)
    }
  }
  return [...boxes].sort(([a], [b]) => a.localeCompare(b)).map(([tag, notes]) => ({ tag, notes }))
}

/** Follow outgoing links across all boxes, grouping each note by its minimum distance. */
export function getRelatedNotesByLevel(notes, rootNoteId, level = 1) {
  if (!Number.isInteger(level) || level < 0) throw new RangeError('Level must be a non-negative integer')
  const byId = new Map(notes.map((note) => [note.noteId, note]))
  if (!byId.has(rootNoteId)) return []
  const visited = new Set([rootNoteId])
  let frontier = [byId.get(rootNoteId)]
  const groups = []
  for (let distance = 1; distance <= level && frontier.length; distance++) {
    const next = []
    for (const note of frontier) {
      for (const id of note.linkedNoteIds ?? []) {
        if (visited.has(id) || !byId.has(id)) continue
        visited.add(id)
        next.push(byId.get(id))
      }
    }
    if (next.length) groups.push({ level: distance, notes: next })
    frontier = next
  }
  return groups
}

/** Pass the selected box's notes; rng is injectable for deterministic callers. */
export function drawRandomNote(notes, rng = Math.random) {
  if (!notes.length) return null
  const value = rng()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random value must be in [0, 1)')
  return notes[Math.floor(value * notes.length)]
}
