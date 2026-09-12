import { useEffect } from 'react'

export function useKeyPress(callback, keyCodes) {
  useEffect(() => {
    const handler = (event) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !keyCodes.includes(event.code)
      )
        return

      // Inspect the composed path too so editors inside a shadow root are protected.
      const targets = event.composedPath?.() || [event.target]
      const isEditing = targets.some(
        (target) =>
          target?.isContentEditable ||
          target?.closest?.(
            'input, select, textarea, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="alertdialog"]'
          )
      )
      if (!isEditing) callback(event)
    }

    window.addEventListener('keydown', handler, { passive: true })
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [callback, keyCodes])
}
