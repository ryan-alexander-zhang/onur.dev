import Link from 'next/link'
import { Suspense } from 'react'

import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { ScrollArea } from '@/components/scroll-area'

export default function CardNotFound() {
  return (
    <ScrollArea useScrollAreaId>
      <Suspense fallback={null}>
        <FloatingHeader title="Card not found" goBackLink="/cards" />
      </Suspense>
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title="卡片暂不可用 · Card not found" />
          <p>这张卡片尚未发布或已移除。This card has not been published or is no longer available.</p>
          <p>
            <Link href="/cards">返回卡片盒 · Back to cards</Link>
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
