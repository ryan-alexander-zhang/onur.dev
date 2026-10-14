'use client'

import { useCallback, useState } from 'react'

const palettes = [
  ['#edf2f4', '#dce8ed', '#506773'],
  ['#eeedf5', '#e0dfee', '#69607f'],
  ['#f4f0e9', '#e9dfcf', '#7b6b52'],
  ['#ecf2ee', '#dce8df', '#52705e'],
  ['#f5edee', '#eddddf', '#805e65']
]

function isPlaceholder(source) {
  if (!source || source === '/assets/fallback.avif') return true
  try {
    const url = new URL(source)
    return url.hostname === 'images.ctfassets.net' && url.pathname.endsWith('/fallback.avif')
  } catch {
    return false
  }
}

export function BookmarkCover({ cover, domain, title, order }) {
  const [status, setStatus] = useState('loading')
  const imageRef = useCallback((image) => {
    // Cached failures/successes may happen before hydration attaches event handlers.
    if (image?.complete) setStatus(image.naturalWidth ? 'loaded' : 'failed')
  }, [])
  const label = domain.replace(/^www\./, '')
  let hash = 0
  for (const character of label) hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0
  const [background, accent, ink] = palettes[hash % palettes.length]
  const initial = (label[0] || title[0] || 'B').toUpperCase()
  const showImage = !isPlaceholder(cover) && status !== 'failed'

  return (
    <span className="relative block aspect-1200/630 w-full overflow-hidden rounded-lg">
      <span
        aria-hidden="true"
        data-bookmark-fallback=""
        className="absolute inset-0 flex flex-col justify-between overflow-hidden border border-black/5 p-[7%]"
        style={{ background: `linear-gradient(135deg, ${background}, ${accent})`, color: ink }}
      >
        <span className="absolute -top-1/2 -right-1/4 aspect-square w-4/5 rounded-full border border-current opacity-[0.08]" />
        <span className="absolute -top-1/4 -right-1/3 aspect-square w-4/5 rounded-full border border-current opacity-[0.08]" />
        <span className="relative flex size-12 items-center justify-center rounded-xl border border-white/60 bg-white/45 text-2xl font-medium tracking-tight sm:size-14 sm:text-3xl">
          {initial}
        </span>
        <span className="relative truncate text-sm font-medium tracking-tight opacity-80">{label}</span>
      </span>
      {showImage && (
        <img
          ref={imageRef}
          src={cover}
          alt={title}
          width={1200}
          height={630}
          loading={order < 2 ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 size-full rounded-lg border object-cover ${status === 'loaded' ? '' : 'opacity-0'}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
          nopin="nopin"
        />
      )}
    </span>
  )
}
