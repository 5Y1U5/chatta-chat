"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Memory = {
  id: string
  content: string
  category: string
  detectedAt: string
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  decision: { label: "決定事項", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  deadline: { label: "期限", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  action: { label: "アクション", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  info: { label: "情報", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
}

type Props = {
  channelId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MemoryPanel({ channelId, open: externalOpen, onOpenChange: externalOnOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/internal/channels/memories?channelId=${channelId}`)
      .then((res) => res.json())
      .then((data) => setMemories(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [open, channelId])

  const handleDelete = async (memoryId: string) => {
    const res = await fetch(`/api/internal/channels/memories?memoryId=${memoryId}`, {
      method: "DELETE",
    })
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== memoryId))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>重要事項メモリ</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          AIが会話から自動検出した重要事項です（5メッセージごとに分析）
        </p>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <span className="text-sm">読み込み中...</span>
            </div>
          )}

          {!loading && memories.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>まだ重要事項はありません</p>
              <p className="text-xs mt-1">会話が進むとAIが自動的に検出します</p>
            </div>
          )}

          {memories.map((m) => {
            const cat = categoryLabels[m.category] || { label: m.category, color: "bg-gray-100 text-gray-700" }
            return (
              <div key={m.id} className="flex items-start gap-2 rounded-md border p-3">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>
                  {cat.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{m.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(m.detectedAt).toLocaleString("ja-JP", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="削除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
