export default function TasksLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="h-5 w-24 rounded bg-muted skeleton-shimmer" />
        <div className="h-8 w-28 rounded bg-muted skeleton-shimmer" />
      </div>

      {/* タスク一覧スケルトン */}
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-1.5">
            <div className="h-4 w-16 rounded bg-muted skeleton-shimmer mb-2" />
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 py-2 px-1">
                <div className="h-4 w-4 rounded border bg-muted shrink-0 skeleton-shimmer" />
                <div className="flex-1">
                  <div className="h-4 rounded bg-muted skeleton-shimmer" style={{ width: `${50 + item * 12}%` }} />
                </div>
                <div className="h-5 w-5 rounded-full bg-muted shrink-0 skeleton-shimmer" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
