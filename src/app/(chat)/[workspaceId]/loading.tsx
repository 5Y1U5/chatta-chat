export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-8 w-24 rounded bg-muted" />
      </div>

      {/* コンテンツスケルトン */}
      <div className="flex-1 overflow-hidden p-4 space-y-6">
        {/* セクションスケルトン */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
