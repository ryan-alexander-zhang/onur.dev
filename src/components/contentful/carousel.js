'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuExpand as ExpandIcon } from 'react-icons/lu'

import { Card, CardContent } from '@/components/ui/card'
import {
  Carousel as CarouselBase,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import { createLightboxSlides, LightboxViewer } from '@/components/ui/zoomable-image'

export function Carousel({ images = [] }) {
  const [api, setApi] = useState()
  const [currentCaption, setCurrentCaption] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const memoizedOpts = useMemo(
    () => ({
      align: 'start',
      loop: true
    }),
    []
  )

  const slides = useMemo(() => createLightboxSlides(images), [images])

  const handleSelect = useCallback(() => {
    if (!api) return
    const nextCaption = images[api.selectedScrollSnap()].title
    setCurrentCaption(nextCaption)
  }, [api, images])

  const openLightboxAtIndex = useCallback((index) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }, [])

  useEffect(() => {
    if (!api) return

    const initialCaption = images[api.selectedScrollSnap()].title
    setCurrentCaption(initialCaption)

    api.on('select', handleSelect)

    return () => {
      api.off('select', handleSelect)
    }
  }, [api, handleSelect, images])

  const memoizedCarouselItems = useMemo(
    () =>
      images.map((imageItem, imageItemIndex) => (
        <CarouselItem key={`carousel_image_item-${imageItemIndex}`}>
          <div className="p-1">
            <Card>
              <CardContent className="flex aspect-square items-center justify-center p-0">
                <button
                  type="button"
                  onClick={() => openLightboxAtIndex(imageItemIndex)}
                  className="group relative block h-full w-full cursor-zoom-in overflow-hidden rounded-xl text-left focus-visible:ring-2 focus-visible:ring-gray-950/20"
                  aria-label={`Open image ${imageItemIndex + 1}${imageItem.description || imageItem.title ? `: ${imageItem.description || imageItem.title}` : ''}`}
                  aria-haspopup="dialog"
                >
                  <img
                    src={imageItem.url}
                    alt={imageItem.title}
                    width={imageItem.width}
                    height={imageItem.height}
                    loading="lazy"
                    className="aspect-square border-none object-cover transition duration-500 group-hover:scale-[1.02] group-hover:brightness-[1.04]"
                    nopin="nopin"
                  />
                  <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-tight text-gray-700 shadow-sm backdrop-blur-sm transition duration-300 group-hover:bg-white">
                    <ExpandIcon size={12} />
                    <span>View</span>
                  </span>
                </button>
              </CardContent>
            </Card>
          </div>
        </CarouselItem>
      )),
    [images, openLightboxAtIndex]
  )

  if (!Array.isArray(images) || !images.length) return null

  return (
    <>
      <CarouselBase setApi={setApi} opts={memoizedOpts} className="w-full">
        <CarouselContent>{memoizedCarouselItems}</CarouselContent>
        <CarouselPrevious className="-left-2.5 bg-white @4xl/writing:-left-12" />
        <CarouselNext className="-right-2.5 bg-white @4xl/writing:-right-12" />
      </CarouselBase>
      <div className="py-2 text-center text-xs font-light text-gray-500">{currentCaption}</div>
      <LightboxViewer
        slides={slides}
        open={lightboxOpen}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
