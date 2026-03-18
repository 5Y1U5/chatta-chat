"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type MemberInfo = {
  id: string
  userId: string
  displayName: string | null
  avatarUrl: string | null
  role: string
}

type Props = {
  projectId: string | null
  projectName?: string
  projectColor?: string | null
  workspaceMembers: { id: string; displayName: string | null; avatarUrl: string | null }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  myRole?: string
}

export function ProjectMembersDialog({ projectId, projectName, projectColor, workspaceMembers, open, onOpenChange, myRole }: Props) {
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMembers = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const res = await fetch(`/api/internal/projects/members?projectId=${projectId}`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (open && projectId) fetchMembers()
  }, [open, projectId, fetchMembers])

  const handleAdd = async (userId: string) => {
    if (!projectId) return
    await fetch("/api/internal/projects/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, userId }),
    })
    await fetchMembers()
  }

  const handleRemove = async (userId: string) => {
    if (!projectId) return
    await fetch(`/api/internal/projects/members?projectId=${projectId}&userId=${userId}`, { method: "DELETE" })
    setMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  const memberIds = new Set(members.map((m) => m.userId))
  const available = workspaceMembers.filter((m) => !memberIds.has(m.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {projectColor && (
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: projectColor }} />
            )}
            {projectName || "プロジェクト"} のメンバー
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">メンバーのみがこのプロジェクトのタスクを閲覧できます</p>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            <>
              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-2 animate-in fade-in-0 duration-200">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {m.displayName?.charAt(0) || "?"}
                      </div>
                      <span className="text-sm flex-1 truncate">{m.displayName || "不明"}</span>
                      {m.role === "owner" && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">オーナー</span>
                      )}
                      {myRole === "owner" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 text-xs text-muted-foreground"
                          onClick={() => handleRemove(m.userId)}
                        >
                          削除
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">メンバーはまだいません</p>
              )}
              {available.length > 0 && (
                <Select value="" onValueChange={(v) => v && handleAdd(v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="メンバーを招待..." />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((m) => (
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
  )
}
