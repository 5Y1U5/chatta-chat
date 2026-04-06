"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CreateTaskDialog } from "@/components/task/CreateTaskDialog"
import { CreateProjectDialog } from "@/components/task/CreateProjectDialog"
import { ProjectMembersDialog } from "@/components/task/ProjectMembersDialog"
import { EmptyState } from "@/components/ui/empty-state"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import type { ProjectInfo } from "@/types/chat"

type Props = {
  projects: ProjectInfo[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  workspaceId: string
  currentUserId?: string
}

export function ProjectListView({ projects: initial, members, workspaceId, currentUserId }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTaskProjectId, setCreateTaskProjectId] = useState<string | null>(null)
  const [manageMembersProjectId, setManageMembersProjectId] = useState<string | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null)

  const refreshProjects = useCallback(async () => {
    const res = await fetch("/api/internal/projects")
    if (res.ok) setProjects(await res.json())
  }, [])

  const handleDeleteProject = useCallback(async () => {
    if (!deleteProjectId) return
    setDeleting(true)
    const res = await fetch(`/api/internal/projects?projectId=${deleteProjectId}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteProjectId))
      setDeleteProjectId(null)
    }
  }, [deleteProjectId])

  const managingProject = projects.find((p) => p.id === manageMembersProjectId)
  const deletingProject = projects.find((p) => p.id === deleteProjectId)

  return (
    <div className="flex flex-col h-full page-enter">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold">プロジェクト</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          プロジェクトを作成
        </Button>
      </div>

      <PullToRefresh onRefresh={refreshProjects} className="flex-1 p-4">
        {projects.length === 0 ? (
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            title="プロジェクトはまだありません"
            description="プロジェクトを作成してタスクを整理しましょう"
            action={{ label: "最初のプロジェクトを作成", onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <div
                key={p.id}
                className="group flex flex-col rounded-xl border p-4 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer stagger-item"
                style={{ animationDelay: `${i * 60}ms` }}
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
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const res = await fetch("/api/internal/projects/invite", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ projectId: p.id }),
                        })
                        if (res.ok) {
                          const { inviteCode } = await res.json()
                          const url = `${window.location.origin}/p/${inviteCode}`
                          await navigator.clipboard.writeText(url)
                          setCopiedProjectId(p.id)
                          setTimeout(() => setCopiedProjectId(null), 2000)
                        }
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {copiedProjectId === p.id ? "コピー済み" : "招待"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
                    {p.myRole === "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteProjectId(p.id)
                        }}
                        title="プロジェクトを削除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>

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
        currentUserId={currentUserId}
      />

      {/* プロジェクトメンバー管理ダイアログ */}
      <ProjectMembersDialog
        projectId={manageMembersProjectId}
        projectName={managingProject?.name}
        projectColor={managingProject?.color}
        workspaceMembers={members}
        open={!!manageMembersProjectId}
        onOpenChange={(v) => !v && setManageMembersProjectId(null)}
        myRole={managingProject?.myRole}
      />

      {/* プロジェクト作成ダイアログ */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshProjects}
      />

      {/* プロジェクト削除確認ダイアログ */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={(v) => !v && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingProject?.name}」を削除します。プロジェクト内のタスクは削除されず、未分類になります。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
