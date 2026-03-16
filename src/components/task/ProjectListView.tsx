"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateTaskDialog } from "@/components/task/CreateTaskDialog"
import { cn } from "@/lib/utils"
import type { ProjectInfo } from "@/types/chat"

const PROJECT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
]

type MemberInfo = { id: string; userId: string; displayName: string | null; avatarUrl: string | null; role: string }

type Props = {
  projects: ProjectInfo[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  workspaceId: string
}

export function ProjectListView({ projects: initial, members, workspaceId }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTaskProjectId, setCreateTaskProjectId] = useState<string | null>(null)
  const [manageMembersProjectId, setManageMembersProjectId] = useState<string | null>(null)
  const [projectMembers, setProjectMembers] = useState<MemberInfo[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const refreshProjects = useCallback(async () => {
    const res = await fetch("/api/internal/projects")
    if (res.ok) setProjects(await res.json())
  }, [])

  const fetchProjectMembers = useCallback(async (projectId: string) => {
    setLoadingMembers(true)
    const res = await fetch(`/api/internal/projects/members?projectId=${projectId}`)
    if (res.ok) setProjectMembers(await res.json())
    setLoadingMembers(false)
  }, [])

  useEffect(() => {
    if (manageMembersProjectId) {
      fetchProjectMembers(manageMembersProjectId)
    }
  }, [manageMembersProjectId, fetchProjectMembers])

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
      await refreshProjects()
    }
    setSubmitting(false)
  }

  const handleAddMember = async (userId: string) => {
    if (!manageMembersProjectId) return
    await fetch("/api/internal/projects/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: manageMembersProjectId, userId }),
    })
    await fetchProjectMembers(manageMembersProjectId)
  }

  const handleRemoveMember = async (userId: string) => {
    if (!manageMembersProjectId) return
    await fetch(`/api/internal/projects/members?projectId=${manageMembersProjectId}&userId=${userId}`, { method: "DELETE" })
    setProjectMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  const managingProject = projects.find((p) => p.id === manageMembersProjectId)
  const memberIds = new Set(projectMembers.map((m) => m.userId))
  const availableMembers = members.filter((m) => !memberIds.has(m.id))

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
              <div
                key={p.id}
                className="group flex flex-col rounded-lg border p-4 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200 cursor-pointer"
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
                <div className="flex items-center justify-between mt-auto gap-1">
                  <span className="text-xs text-muted-foreground">
                    {p._count?.tasks || 0} タスク
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        setManageMembersProjectId(p.id)
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                      </svg>
                      メンバー
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCreateTaskProjectId(p.id)
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      タスク
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* タスク作成ダイアログ */}
      <CreateTaskDialog
        open={!!createTaskProjectId}
        onClose={() => setCreateTaskProjectId(null)}
        onCreated={async () => {
          setCreateTaskProjectId(null)
          await refreshProjects()
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        members={members}
        defaultProjectId={createTaskProjectId || undefined}
        workspaceId={workspaceId}
      />

      {/* メンバー管理ダイアログ */}
      <Dialog open={!!manageMembersProjectId} onOpenChange={(v) => !v && setManageMembersProjectId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {managingProject?.color && (
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: managingProject.color }} />
              )}
              {managingProject?.name} のメンバー
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingMembers ? (
              <div className="flex justify-center py-4">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            ) : (
              <>
                {projectMembers.length > 0 && (
                  <div className="space-y-2">
                    {projectMembers.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2 animate-in fade-in-0 duration-200">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {m.displayName?.charAt(0) || "?"}
                        </div>
                        <span className="text-sm flex-1 truncate">{m.displayName || "不明"}</span>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 text-xs text-muted-foreground"
                          onClick={() => handleRemoveMember(m.userId)}
                        >
                          削除
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {projectMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">メンバーはまだいません</p>
                )}
                {availableMembers.length > 0 && (
                  <Select value="" onValueChange={(v) => v && handleAddMember(v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="メンバーを招待..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.displayName || m.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all duration-200",
                      color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    )}
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
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    作成中
                  </span>
                ) : "作成"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
