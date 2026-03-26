export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <div className="h-5 w-20 rounded bg-muted skeleton-shimmer" />
      </div>

      <div className="flex-1 overflow-hidden p-4 space-y-6">
        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-2">
              <div className="h-3 w-16 rounded bg-muted skeleton-shimmer" />
              <div className="h-8 w-12 rounded bg-muted skeleton-shimmer" />
            </div>
          ))}
        </div>

        {/* リストセクション */}
        {[1, 2].map((section) => (
          <div key={section} className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted skeleton-shimmer" />
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <div className="h-4 w-4 rounded bg-muted shrink-0 skeleton-shimmer" />
                <div className="flex-1">
                  <div className="h-4 rounded bg-muted skeleton-shimmer" style={{ width: `${50 + item * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
