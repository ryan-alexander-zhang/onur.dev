'use client'

export default function CardsError({ reset }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="mb-3 text-xl font-medium">卡片暂时未能加载</h1>
      <p className="mb-6 text-sm leading-7 text-gray-500">读取已发布笔记时遇到了问题，请稍后重试。</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        重新加载
      </button>
    </div>
  )
}
