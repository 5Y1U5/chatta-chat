"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
  asMenuItem?: boolean
  onOpenDialog?: () => void
}

export function MemoryPanel({ channelId, asMenuItem, onOpenDialog }: Props) {
  const [open, setOpen] = useState(false)
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
    await fetch(`/api/internal/channels/memories?memoryId=${memoryId}`, {
      method: "DELETE",
    })
    setMemories((prev) => prev.filter((m) => m.id !== memoryId))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asMenuItem ? (
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={onOpenDialog}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            重要事項メモリ
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="重要事項メモリ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>重要事項メモリ</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">読み込み中...</div>
        ) : memories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>AIが検出した重要事項はまだありません</p>
            <p className="mt-1 text-xs">会話が進むと自動的に検出されます</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {memories.map((m) => {
              const cat = categoryLabels[m.category] || { label: m.category, color: "bg-muted text-foreground" }
              return (
                <div key={m.id} className="flex items-start gap-2 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.detectedAt).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{m.content}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
                    title="削除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
