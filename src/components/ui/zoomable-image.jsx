'use client'

import { useMemo, useState } from 'react'
import { LuExpand as ExpandIcon } from 'react-icons/lu'
import Lightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

import { cn } from '@/lib/utils'

const LIGHTBOX_STYLES = {
  button: {
    filter: 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.35))'
  },
  container: {
    backgroundColor: 'rgba(10, 15, 25, 0.96)',
    backdropFilter: 'blur(20px)'
  }
}

function createSlide({ src, alt, caption, title, width, height }) {
  return {
    alt,
    description: caption || undefined,
    height: Number.isFinite(height) ? height : undefined,
    src,
    title: title || undefined,
    width: Number.isFinite(width) ? width : undefined
  }
}

export function LightboxViewer({ slides = [], open, index = 0, onClose }) {
  const plugins = slides.length > 1 ? [Captions, Counter, Fullscreen, Thumbnails, Zoom] : [Captions, Fullscreen, Zoom]

  if (!slides.length) return null

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={plugins}
      carousel={{
        finite: slides.length === 1,
        imageFit: 'contain',
        padding: '24px',
        preload: slides.length > 1 ? 3 : 1,
        spacing: '12%'
      }}
      animation={{
        fade: 180,
        navigation: 260,
        swipe: 260,
        zoom: 220
      }}
      controller={{
        closeOnBackdropClick: true,
        closeOnEscape: true,
        closeOnPullDown: true
      }}
      captions={{
        descriptionMaxLines: 6,
        descriptionTextAlign: 'center',
        showToggle: slides.length > 1
      }}
      counter={{
        container: {
          style: {
            bottom: '16px',
            left: '16px',
            top: 'unset'
          }
        },
        separator: ' / '
      }}
      styles={LIGHTBOX_STYLES}
      thumbnails={
        slides.length > 1
          ? {
              borderRadius: 12,
              gap: 12,
              height: 64,
              imageFit: 'cover',
              padding: 0,
              showToggle: true,
              vignette: false,
              width: 96
            }
          : undefined
      }
      zoom={{
        doubleClickMaxStops: 3,
        maxZoomPixelRatio: 2.5,
        scrollToZoom: true,
        zoomInMultiplier: 1.8
      }}
    />
  )
}

export function ZoomableImage({
  alt,
  caption,
  className,
  frameClassName,
  height,
  imageClassName,
  loading = 'lazy',
  sizes,
  src,
  title,
  width
}) {
  const [open, setOpen] = useState(false)

  const slides = useMemo(
    () => [createSlide({ alt, caption, height, src, title, width })],
    [alt, caption, height, src, title, width]
  )

  const imageLabel = caption || title || alt
  const accessibleLabel = imageLabel ? `Open image: ${imageLabel}` : 'Open image'

  return (
    <>
      <figure className={cn('mb-6 flex flex-col gap-2', className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'group relative cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(15,23,42,0.45)] focus-visible:ring-2 focus-visible:ring-gray-950/20',
            frameClassName
          )}
          aria-label={accessibleLabel}
          aria-haspopup="dialog"
        >
          <img
            src={src}
            width={width || 400}
            height={height || 300}
            alt={alt}
            loading={loading}
            sizes={sizes}
            className={cn(
              'animate-reveal h-auto w-full transition duration-500 group-hover:scale-[1.01] group-hover:brightness-[1.03]',
              imageClassName
            )}
            nopin="nopin"
          />
          <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-tight text-gray-700 shadow-sm backdrop-blur-sm transition duration-300 group-hover:bg-white">
            <ExpandIcon size={12} />
            <span>Expand</span>
          </span>
        </button>
        {caption && (
          <figcaption className="text-center text-xs font-light break-all text-gray-500">{caption}</figcaption>
        )}
      </figure>
      <LightboxViewer slides={slides} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function createLightboxSlides(images = []) {
  return images
    .map((image) =>
      createSlide({
        alt: image.alt || image.description || image.title,
        caption: image.description || '',
        height: image.height,
        src: image.url || image.src,
        title: image.title,
        width: image.width
      })
    )
    .filter((slide) => slide.src)
}
