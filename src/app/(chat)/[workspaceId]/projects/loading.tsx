export default function ProjectsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="h-5 w-24 rounded bg-muted skeleton-shimmer" />
        <div className="h-8 w-28 rounded bg-muted skeleton-shimmer" />
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted skeleton-shimmer" />
                <div className="h-5 w-32 rounded bg-muted skeleton-shimmer" />
              </div>
              <div className="h-3 w-full rounded bg-muted skeleton-shimmer" />
              <div className="h-3 w-20 rounded bg-muted skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
