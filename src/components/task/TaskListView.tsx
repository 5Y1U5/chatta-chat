"use client"

import { useState, useCallback, useEffect, useRef, memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import { CreateProjectDialog } from "@/components/task/CreateProjectDialog"
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
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
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

// 期日の昇順でソート（古い期限が上）
function sortByDueDate(tasks: TaskInfo[]): TaskInfo[] {
  return [...tasks].sort((a, b) => {
    const da = a.dueDate ? parseDueDateStatic(a.dueDate).getTime() : 0
    const db = b.dueDate ? parseDueDateStatic(b.dueDate).getTime() : 0
    return da - db
  })
}

// parseDueDateのスタティック版（コンポーネント外で使用）
function parseDueDateStatic(dueDate: string): Date {
  const p = dueDate.slice(0, 10).split("-")
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}

// ローカルタイムゾーンで YYYY-MM-DD を返す（toISOString はUTCなのでJSTで日付がずれる）
function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// セクションテーマカラー（ドット・ラベル・カウンターの色）
const sectionThemes: Record<string, { dot: string; text: string; count: string }> = {
  overdue:  { dot: "bg-red-500",     text: "text-red-500",            count: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" },
  today:    { dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400", count: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
  future:   { dot: "bg-gray-400",    text: "text-muted-foreground",   count: "bg-muted" },
  noDue:    { dot: "bg-gray-400",    text: "text-muted-foreground",   count: "bg-muted" },
  doneToday:{ dot: "bg-gray-400",    text: "text-muted-foreground",   count: "bg-muted" },
  done:     { dot: "bg-gray-400",    text: "text-muted-foreground",   count: "bg-muted" },
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
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const pendingTempIdRef = useRef<string | null>(null)

  // 日付変更時にセクション分類を再計算するためのstate
  // SSR/CSR の hydration mismatch を避けるため初期値は null。マウント後に setNow() で確定する
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    if (!now) {
      // 初回マウント時に確定。effect 同期内 setState を避けるため setTimeout でラップ
      const init = setTimeout(() => setNow(new Date()), 0)
      return () => clearTimeout(init)
    }
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const msUntilMidnight = tomorrow.getTime() - Date.now()
    const timer = setTimeout(() => setNow(new Date()), msUntilMidnight + 500)
    return () => clearTimeout(timer)
  }, [now])

  // now が確定する前は派生値を空にしておく（後続の早期 return で UI を出さない）
  const todayEnd = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(0)
  const tomorrowStart = new Date(todayEnd.getTime() + 86400000)
  const todayStart = todayEnd.getTime()

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    )
  }, [tasks, searchQuery])

  const incompleteTasks = filteredTasks.filter((t) => t.status !== "done")
  const doneTasks = sortByPriority(filteredTasks.filter((t) => t.status === "done"))

  // 期限切れ: 期日が昨日以前（期日の古い順で固定）
  const overdueTasks = sortByDueDate(incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const due = parseDueDateStatic(t.dueDate)
    return due.getTime() < todayStart
  }))

  // 今日: 期日が今日（ドラッグで並び替え可）
  const todayDueTasks = sortByPriority(incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const due = parseDueDateStatic(t.dueDate)
    return due.getTime() >= todayStart && due.getTime() < tomorrowStart.getTime()
  }))

  // 今後: 期日が明日以降（期日の近い順で固定）
  const futureTasks = sortByDueDate(incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const due = parseDueDateStatic(t.dueDate)
    return due.getTime() >= tomorrowStart.getTime()
  }))

  // 期限なし: 期日未設定（ドラッグで並び替え可）
  const noDueDateTasks = sortByPriority(incompleteTasks.filter((t) => !t.dueDate))

  // 今日完了したタスク
  const completedTodayTasks = doneTasks.filter((t) => {
    if (!t.completedAt) return false
    return new Date(t.completedAt).getTime() >= todayStart
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

  // タスクのリアルタイム購読（他メンバーの変更を即座に反映）
  // UPDATE は payload.new を直接マージする（全置換しない）。
  // 全置換にすると、楽観的更新の直後に別タスクの Realtime UPDATE が届いた際、
  // GET が PATCH 確定前の古いデータを返してしまい、楽観的更新がロールバックされる。
  useRealtimeTasks({
    workspaceId,
    onTaskChange: useCallback((change) => {
      if (change.event === "DELETE") {
        setTasks((prev) => prev.filter((t) => t.id !== change.id))
        return
      }
      if (change.event === "UPDATE") {
        const raw = change.row as Record<string, unknown>
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== change.id) return t
            const nextAssigneeId = (raw.assigneeId as string | null) ?? null
            const nextProjectId = (raw.projectId as string | null) ?? null
            return {
              ...t,
              title: raw.title as string,
              description: (raw.description as string | null) ?? null,
              status: raw.status as string,
              priority: raw.priority as string,
              assigneeId: nextAssigneeId,
              projectId: nextProjectId,
              parentTaskId: (raw.parentTaskId as string | null) ?? null,
              startDate: (raw.startDate as string | null) ?? null,
              dueDate: (raw.dueDate as string | null) ?? null,
              completedAt: (raw.completedAt as string | null) ?? null,
              recurrenceRule: (raw.recurrenceRule as string | null) ?? null,
              sortOrder: (raw.sortOrder as number) ?? t.sortOrder,
              fileUrl: (raw.fileUrl as string | null) ?? null,
              fileName: (raw.fileName as string | null) ?? null,
              fileType: (raw.fileType as string | null) ?? null,
              updatedAt: (raw.updatedAt as string) ?? t.updatedAt,
              // 担当者・プロジェクトが変わったときのみローカルの members/projects から再解決
              assignee:
                nextAssigneeId === t.assigneeId
                  ? t.assignee
                  : nextAssigneeId
                    ? (members.find((m) => m.id === nextAssigneeId) ?? null)
                    : null,
              project:
                nextProjectId === t.projectId
                  ? t.project
                  : nextProjectId
                    ? (projects.find((p) => p.id === nextProjectId) ?? null)
                    : null,
            }
          })
        )
        return
      }
      // INSERT は join データ（assignee/project/creator/_count）が必要なので API GET
      syncInBackground()
    }, [syncInBackground, members, projects]),
  })

  // タブ/ウィンドウが再度アクティブになったときに同期（別端末対応）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncInBackground()
    }
    const handleFocus = () => syncInBackground()
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleFocus)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleFocus)
    }
  }, [syncInBackground])

  // 楽観的ステータス変更
  // PATCH 失敗時はロールバックし、ユーザーに状態が戻った旨を伝える
  const handleStatusChange = useCallback((taskId: string, status: string) => {
    // ロールバック用に元の値を保持
    let backup: TaskInfo | undefined
    setTasks((prev) => {
      backup = prev.find((t) => t.id === taskId)
      return prev.map((t) =>
        t.id === taskId
          ? { ...t, status, completedAt: status === "done" ? new Date().toISOString() : null }
          : t
      )
    })

    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("ステータス更新失敗")
        return res.json()
      })
      .then((data) => {
        // 繰り返しタスクの場合、サーバーが生成した次回タスクを即座に追加
        if (data?._generatedNextTask) {
          setTasks((prev) => [...prev, data._generatedNextTask])
        }
      })
      .catch((error) => {
        console.error("タスクステータス更新エラー:", error)
        if (backup) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? backup! : t)))
        }
      })
  }, [])

  const handleDueDateChange = useCallback((taskId: string, dueDate: string | null) => {
    let backup: TaskInfo | undefined
    setTasks((prev) => {
      backup = prev.find((t) => t.id === taskId)
      return prev.map((t) => (t.id === taskId ? { ...t, dueDate } : t))
    })
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, dueDate }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("期日更新失敗")
      })
      .catch((error) => {
        console.error("タスク期日更新エラー:", error)
        if (backup) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? backup! : t)))
        }
      })
  }, [])

  const handleStartDateChange = useCallback((taskId: string, startDate: string | null) => {
    let backup: TaskInfo | undefined
    setTasks((prev) => {
      backup = prev.find((t) => t.id === taskId)
      return prev.map((t) => (t.id === taskId ? { ...t, startDate } : t))
    })
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, startDate }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("開始日更新失敗")
      })
      .catch((error) => {
        console.error("タスク開始日更新エラー:", error)
        if (backup) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? backup! : t)))
        }
      })
  }, [])

  const handleRecurrenceChange = useCallback((taskId: string, recurrenceRule: string | null) => {
    let backup: TaskInfo | undefined
    setTasks((prev) => {
      backup = prev.find((t) => t.id === taskId)
      return prev.map((t) => (t.id === taskId ? { ...t, recurrenceRule } : t))
    })
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, recurrenceRule }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("繰り返し設定更新失敗")
      })
      .catch((error) => {
        console.error("タスク繰り返し設定更新エラー:", error)
        if (backup) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? backup! : t)))
        }
      })
  }, [])

  // 並び替えは UI 側で楽観的に setTasks 済み → 失敗時は API GET で再同期
  const handleReorder = useCallback((reorderedTasks: TaskInfo[]) => {
    const taskIds = reorderedTasks.map((t) => t.id)
    fetch("/api/internal/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("並び替え保存失敗")
      })
      .catch((error) => {
        console.error("タスク並び替えエラー:", error)
        // 楽観的更新を破棄してサーバー値で再同期
        syncInBackground()
      })
  }, [syncInBackground])

  // 楽観的タスク追加: ダイアログが即座に閉じてリストに仮追加
  const handleOptimisticTaskCreated = useCallback((tempTask: TaskInfo) => {
    pendingTempIdRef.current = tempTask.id
    setTasks((prev) => [...prev, tempTask])
    setCreateOpen(false)
  }, [])

  // APIレスポンス受信: 仮タスクを実データで置換
  const handleTaskCreated = useCallback((task?: TaskInfo) => {
    if (task && pendingTempIdRef.current) {
      const tempId = pendingTempIdRef.current
      pendingTempIdRef.current = null
      setTasks((prev) => prev.map((t) => t.id === tempId ? task : t))
    } else if (task) {
      setTasks((prev) => [...prev, task])
    } else {
      syncInBackground()
    }
    setCreateOpen(false)
  }, [syncInBackground])

  // インラインタスク追加（楽観的）
  const handleInlineCreate = useCallback(async (title: string, status: string, dueDate?: string) => {
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
      startDate: null,
      dueDate: dueDate || null,
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
        dueDate: dueDate || undefined,
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
      router.push(`/${workspaceId}/tasks`)
    }
  }, [projectId, workspaceId, router])

  const title = viewMode === "my-tasks" ? "マイタスク" : projectName || "プロジェクト"

  // now が CSR で確定するまでは初期 DOM を返す（SSR と一致させて hydration mismatch を回避）
  if (!now) {
    return (
      <div className="flex h-full page-enter" suppressHydrationWarning>
        <div className="flex flex-1 flex-col overflow-hidden" />
      </div>
    )
  }

  return (
    <div className="flex h-full page-enter">
      {/* タスクリスト */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* プロジェクトカラーアクセント */}
        {viewMode === "project" && projectColor && (
          <div className="h-1 shrink-0" style={{ backgroundColor: projectColor }} />
        )}
        {/* ヘッダー */}
        <div className="shrink-0 border-b py-4 px-5">
          <div className={cn("flex items-center justify-between", isMobile && "hidden")}>
            <div className="flex items-center gap-2 min-w-0">
              {viewMode === "project" && projectColor && (
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
              )}
              {/* タイトル + ビュー切り替えドロップダウン */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xl font-bold truncate hover:text-muted-foreground transition-colors">
                    {title}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  {/* マイタスク */}
                  <DropdownMenuItem
                    className={cn(viewMode === "my-tasks" && "bg-muted font-medium")}
                    onClick={() => {
                      if (viewMode !== "my-tasks") {
                        router.push(`/${workspaceId}/tasks`, { scroll: false })
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-muted-foreground">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    マイタスク
                  </DropdownMenuItem>
                  {/* プロジェクト一覧 */}
                  {projects.length > 0 && (
                    <div className="mx-2 my-1 border-t" />
                  )}
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      className={cn(viewMode === "project" && projectId === p.id && "bg-muted font-medium")}
                      onClick={() => {
                        if (projectId !== p.id) {
                          router.push(`/${workspaceId}/tasks?projectId=${p.id}`, { scroll: false })
                        }
                      }}
                    >
                      <span
                        className="mr-2 h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || "#6B7280" }}
                      />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                  <div className="mx-2 my-1 border-t" />
                  <DropdownMenuItem onClick={() => setCreateProjectOpen(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-muted-foreground">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    プロジェクトを作成
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/${workspaceId}/projects`, { scroll: false })}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-muted-foreground">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    すべて表示
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              {overdueTasks.length > 0 && (
                <span className="ml-1">
                  ・ 期限切れ <span className="text-red-500 font-medium">{overdueTasks.length}件</span>
                </span>
              )}
              {todayDueTasks.length > 0 && (
                <span className="ml-1">
                  ・ 本日期限 <span className="text-orange-500 font-medium">{todayDueTasks.length}件</span>
                </span>
              )}
            </p>
          )}
          <div className="relative mt-3">
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
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タスクを検索..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <PullToRefresh onRefresh={async () => { syncInBackground() }} className="flex-1 px-5 py-2 space-y-4">
          {/* 期限切れ（期日順固定・ドラッグ不可） */}
          {overdueTasks.length > 0 && (
            <TaskSection
              label="期限切れ"
              sectionTheme="overdue"
              tasks={overdueTasks}
              allTasks={tasks}
              setTasks={setTasks}
              onSelect={setSelectedTaskId}
              selectedId={selectedTaskId}
              onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
              onReorder={handleReorder}
              isMobile={isMobile}
              sortable={false}
            />
          )}

          {/* 今日（ドラッグで並び替え可） */}
          <TaskSection
            label="今日"
            sectionTheme="today"
            tasks={todayDueTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
            onStartDateChange={handleStartDateChange}
            onRecurrenceChange={handleRecurrenceChange}
            onReorder={handleReorder}
            onInlineCreate={handleInlineCreate}
            defaultDueDate={formatLocalDate(todayEnd)}
            isMobile={isMobile}
          />

          {/* 今後（期日順固定・ドラッグ不可・デフォルト折りたたみ） */}
          <TaskSection
            label="今後"
            sectionTheme="future"
            tasks={futureTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
            onStartDateChange={handleStartDateChange}
            onRecurrenceChange={handleRecurrenceChange}
            onReorder={handleReorder}
            onInlineCreate={handleInlineCreate}
            defaultDueDate={formatLocalDate(tomorrowStart)}
            defaultCollapsed
            isMobile={isMobile}
            sortable={false}
          />

          {/* 期限なし（ドラッグで並び替え可・デフォルト折りたたみ） */}
          <TaskSection
            label="期限なし"
            sectionTheme="noDue"
            tasks={noDueDateTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
            onStartDateChange={handleStartDateChange}
            onRecurrenceChange={handleRecurrenceChange}
            onReorder={handleReorder}
            onInlineCreate={handleInlineCreate}
            defaultCollapsed
            isMobile={isMobile}
          />

          {/* 今日完了 */}
          {completedTodayTasks.length > 0 && (
            <TaskSection
              label="今日完了"
              sectionTheme="doneToday"
              tasks={completedTodayTasks}
              allTasks={tasks}
              setTasks={setTasks}
              onSelect={setSelectedTaskId}
              selectedId={selectedTaskId}
              onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
              onReorder={handleReorder}
              isMobile={isMobile}
            />
          )}

          {/* 完了 */}
          <TaskSection
            label="完了"
            sectionTheme="done"
            tasks={doneTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onDueDateChange={handleDueDateChange}
            onStartDateChange={handleStartDateChange}
            onRecurrenceChange={handleRecurrenceChange}
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
        </PullToRefresh>
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
        onOptimisticCreate={handleOptimisticTaskCreated}
        projects={projects}
        members={members}
        defaultProjectId={projectId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
      />

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={() => {
          setCreateProjectOpen(false)
          router.push(`/${workspaceId}/projects`, { scroll: false })
        }}
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
  onDueDateChange,
  onStartDateChange,
  onRecurrenceChange,
  isMobile,
}: {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
  onDueDateChange?: (taskId: string, dueDate: string | null) => void
  onStartDateChange?: (taskId: string, startDate: string | null) => void
  onRecurrenceChange?: (taskId: string, recurrenceRule: string | null) => void
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
    transition: transition || undefined,
    // ドラッグ中はプレースホルダとして半透明表示（DragOverlay が実体を表示）
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? -1 : undefined,
    ...(isMobile ? {
      WebkitUserSelect: "none",
      userSelect: "none",
      WebkitTouchCallout: "none",
    } as React.CSSProperties : {}),
  }

  const handleSelect = useCallback(() => {
    if (!isDraggingRef.current) onSelect()
  }, [onSelect])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group/sortable", isMobile && "touch-manipulation select-none")}
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
        onDueDateChange={onDueDateChange}
        onStartDateChange={onStartDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />
    </div>
  )
})

// インラインタスク追加コンポーネント
function InlineAddTask({
  sectionStatus,
  defaultDueDate,
  onSubmit,
}: {
  sectionStatus: string
  defaultDueDate?: string
  onSubmit: (title: string, status: string, dueDate?: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")

  const handleSubmit = () => {
    if (!title.trim()) return
    const t = title
    setTitle("")
    setEditing(false)
    // 非同期だがUIは既にリセット済み
    onSubmit(t, sectionStatus, defaultDueDate)
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
  sectionTheme: themeKey,
  tasks,
  allTasks,
  setTasks,
  onSelect,
  selectedId,
  onStatusChange,
  onDueDateChange,
  onStartDateChange,
  onRecurrenceChange,
  onReorder,
  onInlineCreate,
  defaultDueDate,
  defaultInlineStatus = "todo",
  defaultCollapsed = false,
  isMobile = false,
  sortable = true,
}: {
  label: string
  sectionTheme: string
  tasks: TaskInfo[]
  allTasks: TaskInfo[]
  setTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>
  onSelect: (id: string) => void
  selectedId: string | null
  onStatusChange: (taskId: string, status: string) => void
  onDueDateChange?: (taskId: string, dueDate: string | null) => void
  onStartDateChange?: (taskId: string, startDate: string | null) => void
  onRecurrenceChange?: (taskId: string, recurrenceRule: string | null) => void
  onReorder: (tasks: TaskInfo[]) => void
  onInlineCreate?: (title: string, status: string, dueDate?: string) => Promise<void>
  defaultDueDate?: string
  defaultInlineStatus?: string
  defaultCollapsed?: boolean
  isMobile?: boolean
  sortable?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [activeId, setActiveId] = useState<string | null>(null)

  // モバイルでは LongPressTouchSensor のみ（PointerSensor がタッチを奪う問題を回避）
  const desktopSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )
  const mobileSensors = useSensors(
    useSensor(LongPressTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 15 },
    })
  )
  const sensors = isMobile ? mobileSensors : desktopSensors

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
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

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  // 完了セクションのような「タスクがなければ非表示」は inline 追加のないセクションのみ
  if (tasks.length === 0 && defaultCollapsed && !onInlineCreate) return null

  const theme = sectionThemes[themeKey] || sectionThemes.done

  return (
    <div>
      <button
        className={cn("flex items-center gap-2 text-sm font-medium mb-1 py-1", theme.text)}
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
        {/* セクションドット */}
        <span className={cn("h-2 w-2 rounded-full shrink-0", theme.dot)} />
        {label}
        <span className={cn("rounded-full px-2 py-0.5 text-xs", theme.count)}>{tasks.length}</span>
      </button>
      {!collapsed && (
        <>
          {sortable ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              autoScroll={{ threshold: { x: 0, y: 0.2 }, interval: 5 }}
            >
              <SortableContext
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={isMobile ? "" : "pl-2"}>
                  {tasks.map((task) => (
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      isSelected={selectedId === task.id}
                      onSelect={() => onSelect(task.id)}
                      onStatusChange={onStatusChange}
                      onDueDateChange={onDueDateChange}
                      onStartDateChange={onStartDateChange}
                      onRecurrenceChange={onRecurrenceChange}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeTask && (
                  <div
                    style={{
                      transform: "scale(1.03)",
                      boxShadow: "0 12px 28px rgba(0,0,0,0.2)",
                      borderRadius: "8px",
                      background: "var(--color-card, white)",
                      opacity: 0.95,
                    }}
                  >
                    <TaskItem
                      task={activeTask}
                      isSelected={false}
                      onSelect={() => {}}
                      onStatusChange={() => {}}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className={isMobile ? "" : "pl-2"}>
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isSelected={selectedId === task.id}
                  onSelect={() => onSelect(task.id)}
                  onStatusChange={onStatusChange}
                  onDueDateChange={onDueDateChange}
                  onStartDateChange={onStartDateChange}
                  onRecurrenceChange={onRecurrenceChange}
                />
              ))}
            </div>
          )}
          {/* インラインタスク追加 */}
          {onInlineCreate && (
            <div className={isMobile ? "" : "pl-2"}>
              <InlineAddTask sectionStatus={defaultInlineStatus} defaultDueDate={defaultDueDate} onSubmit={onInlineCreate} />
            </div>
          )}
        </>
      )}
      {/* セクション間区切り線 */}
      <div className="border-b border-border/30 mt-2" />
    </div>
  )
}
