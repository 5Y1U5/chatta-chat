"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProjectInfo } from "@/types/chat"

const PROJECT_COLORS = [
  "#3B82F6", // 青
  "#10B981", // 緑
  "#F59E0B", // 黄
  "#EF4444", // 赤
  "#8B5CF6", // 紫
  "#EC4899", // ピンク
  "#06B6D4", // シアン
  "#F97316", // オレンジ
]

type Props = {
  projects: ProjectInfo[]
  workspaceId: string
}

export function ProjectListView({ projects: initial, workspaceId }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)

    const res = await fetch("/api/internal/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    })

    if (res.ok) {
      setName("")
      setColor(PROJECT_COLORS[0])
      setCreateOpen(false)
      // 一覧を再取得
      const listRes = await fetch("/api/internal/projects")
      if (listRes.ok) setProjects(await listRes.json())
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold">プロジェクト</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          プロジェクトを作成
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p>プロジェクトはまだありません</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
              最初のプロジェクトを作成
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <button
                key={p.id}
                className="flex flex-col rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/${workspaceId}/tasks?projectId=${p.id}`)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || "#6B7280" }}
                  />
                  <span className="font-medium truncate">{p.name}</span>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
                )}
                <span className="text-xs text-muted-foreground">
                  {p._count?.tasks || 0} タスク
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* プロジェクト作成ダイアログ */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>プロジェクトを作成</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              placeholder="プロジェクト名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">カラー</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 transition-colors ${
                      color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!name.trim() || submitting}>
                {submitting ? "作成中..." : "作成"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
