"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type SearchResult = {
  id: string
  content: string
  createdAt: string
  parentId: string | null
  channelId: string
  channelName: string | null
  channelType: string
  user: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
}

type Props = {
  workspaceId: string
  open: boolean
  onClose: () => void
}

export function SearchModal({ workspaceId, open, onClose }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // 開いた時にフォーカス
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // ESC で閉じる
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/internal/messages/search?q=${encodeURIComponent(q.trim())}`
      )
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  function handleClickResult(result: SearchResult) {
    onClose()
    router.push(`/${workspaceId}/channel/${result.channelId}`)
  }

  if (!open) return null

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div className="fixed inset-x-4 top-16 z-50 mx-auto max-w-lg rounded-lg border bg-background shadow-xl md:inset-x-auto">
        {/* 検索入力 */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="メッセージを検索..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
            ESC
          </Button>
        </div>

        {/* 結果 */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              検索中...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              該当するメッセージが見つかりません
            </div>
          )}

          {!loading && results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleClickResult(result)}
              className="flex w-full flex-col gap-1 border-b px-4 py-3 text-left hover:bg-muted/50 last:border-b-0"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">
                  {result.channelType === "dm"
                    ? "DM"
                    : `# ${result.channelName || "名前なし"}`}
                </span>
                <span>
                  {result.user.displayName || "不明"}
                </span>
                <span>
                  {formatDate(result.createdAt)}
                </span>
              </div>
              <p className="text-sm line-clamp-2 break-words">
                {result.content}
              </p>
            </button>
          ))}

          {!loading && !query.trim() && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              キーワードを入力して検索
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  if (isToday) {
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
  }

  return d.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
