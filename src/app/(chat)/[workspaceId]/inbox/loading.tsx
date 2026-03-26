export default function InboxLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="h-5 w-20 rounded bg-muted skeleton-shimmer" />
      </div>

      {/* 通知一覧スケルトン */}
      <div className="flex-1 overflow-hidden">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="flex items-start gap-3 border-b px-4 py-4">
            <div className="h-10 w-10 rounded-full bg-muted shrink-0 skeleton-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded bg-muted skeleton-shimmer" style={{ width: `${60 + item * 5}%` }} />
              <div className="h-3 w-20 rounded bg-muted skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
