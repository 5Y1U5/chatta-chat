"use client"

import { useState, useCallback, useEffect, useRef, memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { LongPressTouchSensor } from "@/lib/LongPressTouchSensor"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskItem } from "@/components/task/TaskItem"
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel"
import { CreateTaskDialog } from "@/components/task/CreateTaskDialog"
import { ProjectMembersDialog } from "@/components/task/ProjectMembersDialog"
import { EmptyState } from "@/components/ui/empty-state"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { TaskInfo } from "@/types/chat"

type Props = {
  tasks: TaskInfo[]
  projects: { id: string; name: string; color: string | null }[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  workspaceId: string
  currentUserId: string
  viewMode: "my-tasks" | "project"
  projectId?: string
  projectName?: string
  projectColor?: string | null
  projectMembers?: { id: string; displayName: string | null; avatarUrl: string | null }[]
  initialSelectedTaskId?: string
  projectMyRole?: string
}

// 優先度の重み（小さいほど上）
const PRIORITY_WEIGHT: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

// 優先度 → sortOrder → 作成日時の順でソート
function sortByPriority(tasks: TaskInfo[]): TaskInfo[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority] ?? 1
    const pb = PRIORITY_WEIGHT[b.priority] ?? 1
    if (pa !== pb) return pa - pb
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

// ステータスドットの色
const statusDotColors: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  done: "bg-primary",
  completed_today: "bg-primary",
}

export function TaskListView({
  tasks: initialTasks,
  projects,
  members,
  workspaceId,
  currentUserId,
  viewMode,
  projectId,
  projectName,
  projectColor,
  projectMembers = [],
  initialSelectedTaskId,
  projectMyRole,
}: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialSelectedTaskId || null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)

  // 日付変更時にセクション分類を再計算するためのstate
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const msUntilMidnight = tomorrow.getTime() - Date.now()
    const timer = setTimeout(() => setNow(new Date()), msUntilMidnight + 500)
    return () => clearTimeout(timer)
  }, [now])

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayEnd.getTime() + 86400000)
  const todayStart = todayEnd.getTime()

  const incompleteTasks = tasks.filter((t) => t.status !== "done")
  const doneTasks = sortByPriority(tasks.filter((t) => t.status === "done"))

  // 期日をパースするヘルパー
  const parseDueDate = (dueDate: string): Date => {
    const p = dueDate.slice(0, 10).split("-")
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  }

  // マイタスク（タスク）: 期日なし or 期日が今日以前
  const myTasks = sortByPriority(incompleteTasks.filter((t) => {
    if (!t.dueDate) return true
    const due = parseDueDate(t.dueDate)
    return due.getTime() < tomorrowStart.getTime()
  }))

  // 明日以降のタスク: 期日が明日以降
  const futureTasks = sortByPriority(incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const due = parseDueDate(t.dueDate)
    return due.getTime() >= tomorrowStart.getTime()
  }))

  // 今日完了したタスク
  const completedTodayTasks = doneTasks.filter((t) => {
    if (!t.completedAt) return false
    return new Date(t.completedAt).getTime() >= todayStart
  })

  // 本日期限タスク数
  const todayDueTasks = incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const due = parseDueDate(t.dueDate)
    return due.getTime() === todayStart
  })

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null

  // バックグラウンド同期（UIをブロックしない）
  const syncInBackground = useCallback(() => {
    const params = new URLSearchParams()
    if (viewMode === "my-tasks") {
      params.set("assigneeId", currentUserId)
    }
    if (projectId) {
      params.set("projectId", projectId)
    }
    fetch(`/api/internal/tasks?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setTasks(data) })
      .catch(() => {})
  }, [viewMode, currentUserId, projectId])

  // 楽観的ステータス変更
  const handleStatusChange = useCallback((taskId: string, status: string) => {
    const targetTask = tasks.find((t) => t.id === taskId)
    // 即座にローカル state を更新
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status, completedAt: status === "done" ? new Date().toISOString() : null }
          : t
      )
    )
    // API をバックグラウンドで呼ぶ
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    }).then(() => {
      // 繰り返しタスクの場合、サーバーが次回タスクを生成するのでバックグラウンド同期
      if (targetTask?.recurrenceRule && status === "done") {
        syncInBackground()
      }
    })
  }, [tasks, syncInBackground])

  const handleReorder = useCallback((reorderedTasks: TaskInfo[]) => {
    const taskIds = reorderedTasks.map((t) => t.id)
    fetch("/api/internal/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    })
  }, [])

  // ダイアログからのタスク作成（APIレスポンスを受け取って即座に追加）
  const handleTaskCreated = useCallback((task?: TaskInfo) => {
    if (task) {
      setTasks((prev) => [...prev, task])
    } else {
      syncInBackground()
    }
    setCreateOpen(false)
  }, [syncInBackground])

  // インラインタスク追加（楽観的）
  const handleInlineCreate = useCallback(async (title: string, status: string) => {
    const tempId = crypto.randomUUID()
    const tempTask: TaskInfo = {
      id: tempId,
      workspaceId,
      projectId: projectId || null,
      parentTaskId: null,
      title: title.trim(),
      description: null,
      status,
      priority: "medium",
      assigneeId: viewMode === "my-tasks" ? currentUserId : null,
      creatorId: currentUserId,
      dueDate: null,
      completedAt: null,
      recurrenceRule: null,
      sortOrder: 9999,
      fileUrl: null,
      fileName: null,
      fileType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignee: viewMode === "my-tasks"
        ? (members.find((m) => m.id === currentUserId) || { id: currentUserId, displayName: null, avatarUrl: null })
        : null,
      creator: members.find((m) => m.id === currentUserId) || { id: currentUserId, displayName: null, avatarUrl: null },
      project: projectId ? (projects.find((p) => p.id === projectId) || null) : null,
      _count: { subTasks: 0, comments: 0 },
    }

    // 即座にローカルに追加
    setTasks((prev) => [...prev, tempTask])

    // API呼び出し → 成功したらサーバーのデータで置換
    const res = await fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        status,
        workspaceId,
        assigneeId: viewMode === "my-tasks" ? currentUserId : undefined,
        projectId: projectId || undefined,
      }),
    })
    if (res.ok) {
      const realTask = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === tempId ? realTask : t)))
    }
  }, [workspaceId, projectId, viewMode, currentUserId, members, projects])

  // 詳細パネルからの楽観的タスク更新
  const handleOptimisticTaskUpdate = useCallback((taskId: string, updates: Partial<TaskInfo>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
  }, [])

  // プロジェクト削除
  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return
    setDeleting(true)
    const res = await fetch(`/api/internal/projects?projectId=${projectId}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      setDeleteDialogOpen(false)
      window.history.pushState(null, "", `/${workspaceId}/tasks`)
      router.refresh()
    }
  }, [projectId, workspaceId, router])

  const title = viewMode === "my-tasks" ? "マイタスク" : projectName || "プロジェクト"

  return (
    <div className="flex h-full page-enter">
      {/* タスクリスト */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="shrink-0 border-b py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {viewMode === "project" && projectColor && (
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
              )}
              <h1 className="text-xl font-bold truncate">{title}</h1>
              {viewMode === "project" && projectId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      プロジェクトを削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* プロジェクトビュー: メンバーアバタースタック */}
              {viewMode === "project" && projectMembers.length > 0 && (
                <button
                  onClick={() => setMembersDialogOpen(true)}
                  className="flex items-center -space-x-1.5 hover:opacity-80 transition-opacity"
                  title="メンバー管理"
                >
                  {projectMembers.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium border-2 border-background"
                      title={m.displayName || undefined}
                    >
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        m.displayName?.charAt(0) || "?"
                      )}
                    </div>
                  ))}
                  {projectMembers.length > 3 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium border-2 border-background">
                      +{projectMembers.length - 3}
                    </div>
                  )}
                </button>
              )}
              {viewMode === "project" && projectMembers.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setMembersDialogOpen(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  メンバー管理
                </Button>
              )}
              {!isMobile && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  タスクを追加
                </Button>
              )}
            </div>
          </div>
          {incompleteTasks.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              未完了 {incompleteTasks.length}件
              {todayDueTasks.length > 0 && (
                <span className="ml-1">
                  ・ 本日期限 <span className="text-red-500 font-medium">{todayDueTasks.length}件</span>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {/* マイタスク / タスク */}
          <TaskSection
            label={viewMode === "my-tasks" ? "マイタスク" : "タスク"}
            sectionStatus="todo"
            tasks={myTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            onInlineCreate={!isMobile ? handleInlineCreate : undefined}
            isMobile={isMobile}
          />

          {/* 明日以降のタスク */}
          <TaskSection
            label="明日以降のタスク"
            sectionStatus="in_progress"
            tasks={futureTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            isMobile={isMobile}
          />

          {/* 今日完了 */}
          {completedTodayTasks.length > 0 && (
            <TaskSection
              label="今日完了"
              sectionStatus="done"
              tasks={completedTodayTasks}
              allTasks={tasks}
              setTasks={setTasks}
              onSelect={setSelectedTaskId}
              selectedId={selectedTaskId}
              onStatusChange={handleStatusChange}
              onReorder={handleReorder}
              isMobile={isMobile}
            />
          )}

          {/* 完了 */}
          <TaskSection
            label="完了"
            sectionStatus="done"
            tasks={doneTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            defaultCollapsed
            isMobile={isMobile}
          />

          {tasks.length === 0 && (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              }
              title="タスクはまだありません"
              description="タスクを作成して、チームの作業を管理しましょう"
              action={{ label: "最初のタスクを作成", onClick: () => setCreateOpen(true) }}
            />
          )}
        </div>
      </div>

      {/* タスク詳細パネル */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          projects={projects}
          members={members}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          onClose={() => setSelectedTaskId(null)}
          onOptimisticUpdate={handleOptimisticTaskUpdate}
          onTaskDeleted={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId))
            setSelectedTaskId(null)
          }}
        />
      )}

      {/* モバイル用 FAB（右下固定） */}
      {isMobile && (
        <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* タスク作成ダイアログ */}
      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleTaskCreated}
        projects={projects}
        members={members}
        defaultProjectId={projectId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
      />

      {/* プロジェクトメンバー管理ダイアログ */}
      {viewMode === "project" && projectId && (
        <ProjectMembersDialog
          projectId={projectId}
          projectName={projectName}
          projectColor={projectColor}
          workspaceMembers={members}
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          myRole={projectMyRole}
        />
      )}

      {/* プロジェクト削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{projectName}」を削除します。プロジェクト内のタスクは削除されず、未分類になります。この操作は取り消せません。
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

// ドラッグ可能なタスクアイテム（メモ化で再レンダリング抑制）
const SortableTaskItem = memo(function SortableTaskItem({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  isMobile,
}: {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
  isMobile: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  // ドラッグ中はクリックイベントを無効化（ドラッグ終了後の誤タップ防止）
  const isDraggingRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      isDraggingRef.current = true
    } else {
      // ドラッグ終了後に少し待ってからフラグを戻す（タッチエンド → クリックの順序対策）
      const timer = setTimeout(() => { isDraggingRef.current = false }, 200)
      return () => clearTimeout(timer)
    }
  }, [isDragging])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? `${transition}, box-shadow 200ms ease, transform 200ms ease`
      : transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : undefined,
    ...(isDragging
      ? {
          scale: "1.02",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          borderRadius: "8px",
          background: "var(--color-card, white)",
        }
      : {}),
  }

  const handleSelect = useCallback(() => {
    if (!isDraggingRef.current) onSelect()
  }, [onSelect])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group/sortable", isMobile && "touch-manipulation")}
      {...(isMobile ? { ...attributes, ...listeners } : {})}
    >
      {/* ドラッグハンドル（デスクトップのみ） */}
      {!isMobile && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 z-10 touch-none"
          style={{ left: "-20px" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
          </svg>
        </div>
      )}
      <TaskItem
        task={task}
        isSelected={isSelected}
        onSelect={handleSelect}
        onStatusChange={onStatusChange}
      />
    </div>
  )
})

// インラインタスク追加コンポーネント
function InlineAddTask({
  sectionStatus,
  onSubmit,
}: {
  sectionStatus: string
  onSubmit: (title: string, status: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")

  const handleSubmit = () => {
    if (!title.trim()) return
    const t = title
    setTitle("")
    setEditing(false)
    // 非同期だがUIは既にリセット済み
    onSubmit(t, sectionStatus)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-b border-border/50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        タスクを追加...
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
      <Input
        autoFocus
        className="h-8 text-sm flex-1"
        placeholder="タスク名を入力..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit() }
          if (e.key === "Escape") { setEditing(false); setTitle("") }
        }}
      />
      <Button size="sm" className="h-8 shrink-0" onClick={handleSubmit} disabled={!title.trim()}>
        追加
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 shrink-0"
        onClick={() => { setEditing(false); setTitle("") }}
      >
        キャンセル
      </Button>
    </div>
  )
}

function TaskSection({
  label,
  sectionStatus,
  tasks,
  allTasks,
  setTasks,
  onSelect,
  selectedId,
  onStatusChange,
  onReorder,
  onInlineCreate,
  defaultCollapsed = false,
  isMobile = false,
}: {
  label: string
  sectionStatus: string
  tasks: TaskInfo[]
  allTasks: TaskInfo[]
  setTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>
  onSelect: (id: string) => void
  selectedId: string | null
  onStatusChange: (taskId: string, status: string) => void
  onReorder: (tasks: TaskInfo[]) => void
  onInlineCreate?: (title: string, status: string) => Promise<void>
  defaultCollapsed?: boolean
  isMobile?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(LongPressTouchSensor, {
      activationConstraint: { delay: 400, tolerance: 10 },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // セクション内のタスクを並び替え
    const reordered = [...tasks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    // sortOrder を振り直す
    const updatedSection = reordered.map((t, i) => ({ ...t, sortOrder: i }))

    // 全タスクの state を更新（このセクションのタスクだけ入れ替え）
    const sectionIds = new Set(tasks.map((t) => t.id))
    const otherTasks = allTasks.filter((t) => !sectionIds.has(t.id))
    setTasks([...otherTasks, ...updatedSection])

    // サーバーに保存
    onReorder(updatedSection)
  }

  if (tasks.length === 0 && defaultCollapsed) return null

  const dotColor = statusDotColors[sectionStatus] || "bg-gray-400"

  return (
    <div>
      <button
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-1 py-1"
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${collapsed ? "" : "rotate-90"}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {/* ステータスドット */}
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
        {label}
        <span className="bg-muted rounded-full px-2 py-0.5 text-xs">{tasks.length}</span>
      </button>
      {!collapsed && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="pl-2">
                {tasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    isSelected={selectedId === task.id}
                    onSelect={() => onSelect(task.id)}
                    onStatusChange={onStatusChange}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {/* インラインタスク追加 */}
          {onInlineCreate && (
            <div className="pl-2">
              <InlineAddTask sectionStatus={sectionStatus} onSubmit={onInlineCreate} />
            </div>
          )}
        </>
      )}
      {/* セクション間区切り線 */}
      <div className="border-b border-border/30 mt-2" />
    </div>
  )
}
