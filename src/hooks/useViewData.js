import { useEffect, useState } from 'react'

import { SUPABASE_TABLE_NAME } from '@/lib/constants'
import supabase from '@/lib/supabase/public'

export const useViewData = (slug) => {
  const [viewData, setViewData] = useState(null)

  useEffect(() => {
    async function getViewData() {
      const supabaseQuery = supabase.from(SUPABASE_TABLE_NAME).select('slug, view_count')
      if (slug) supabaseQuery.eq('slug', slug)

      const { data: supabaseData, error } = await supabaseQuery

      if (error) {
        console.info('Error fetching view data from Supabase:', error)
        return
      }

      setViewData(supabaseData ?? [])
    }

    getViewData()
  }, [slug])

  useEffect(() => {
    function handleRealtimeChange(payload) {
      if (payload?.new?.slug) {
        setViewData((prev) => {
          if (!prev) return [payload.new]

          const index = prev.findIndex((item) => item.slug === payload.new.slug)

          if (index !== -1) {
            const next = [...prev]
            next[index] = payload.new
            return next
          }

          return [...prev, payload.new]
        })
      }
    }

    const channel = supabase
      .channel('supabase_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: SUPABASE_TABLE_NAME,
          ...(slug && { filter: `slug=eq.${slug}` })
        },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: SUPABASE_TABLE_NAME,
          ...(slug && { filter: `slug=eq.${slug}` })
        },
        handleRealtimeChange
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [slug])

  return viewData
}
