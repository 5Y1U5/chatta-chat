"use client"

import { useState, useCallback } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
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
import { EmptyState } from "@/components/ui/empty-state"
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
  initialSelectedTaskId?: string
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
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

// ステータスドットの色
const statusDotColors: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  completed_today: "bg-green-500",
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
  initialSelectedTaskId,
}: Props) {
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialSelectedTaskId || null)
  const [createOpen, setCreateOpen] = useState(false)

  const todoTasks = sortByPriority(tasks.filter((t) => t.status === "todo"))
  const inProgressTasks = sortByPriority(tasks.filter((t) => t.status === "in_progress"))
  const doneTasks = sortByPriority(tasks.filter((t) => t.status === "done"))

  // 今日完了したタスク
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const completedTodayTasks = doneTasks.filter((t) => {
    if (!t.completedAt) return false
    return new Date(t.completedAt).getTime() >= todayStart
  })

  // 未完了タスク数と本日期限タスク数
  const incompleteTasks = tasks.filter((t) => t.status !== "done")
  const todayDueTasks = incompleteTasks.filter((t) => {
    if (!t.dueDate) return false
    const dueParts = t.dueDate.slice(0, 10).split("-")
    const dueDay = new Date(Number(dueParts[0]), Number(dueParts[1]) - 1, Number(dueParts[2]))
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return dueDay.getTime() === today.getTime()
  })

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null

  const refreshTasks = useCallback(async () => {
    const params = new URLSearchParams()
    if (viewMode === "my-tasks") {
      params.set("assigneeId", currentUserId)
    }
    if (projectId) {
      params.set("projectId", projectId)
    }

    const res = await fetch(`/api/internal/tasks?${params}`)
    if (res.ok) {
      const data = await res.json()
      setTasks(data)
    }
  }, [viewMode, currentUserId, projectId])

  const handleStatusChange = async (taskId: string, status: string) => {
    const res = await fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    })
    if (res.ok) {
      await refreshTasks()
    }
  }

  const handleReorder = useCallback(async (reorderedTasks: TaskInfo[]) => {
    const taskIds = reorderedTasks.map((t) => t.id)
    await fetch("/api/internal/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    })
  }, [])

  const handleTaskCreated = async () => {
    await refreshTasks()
    setCreateOpen(false)
  }

  // インラインタスク追加
  const handleInlineCreate = async (title: string, status: string) => {
    await fetch("/api/internal/tasks", {
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
    await refreshTasks()
  }

  const title = viewMode === "my-tasks" ? "マイタスク" : projectName || "プロジェクト"

  return (
    <div className="flex h-full page-enter">
      {/* タスクリスト */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="shrink-0 border-b py-4 px-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{title}</h1>
            {!isMobile && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                タスクを追加
              </Button>
            )}
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
          {/* 未着手 */}
          <TaskSection
            label="未着手"
            sectionStatus="todo"
            tasks={todoTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            onInlineCreate={!isMobile ? handleInlineCreate : undefined}
          />

          {/* 進行中 */}
          <TaskSection
            label="進行中"
            sectionStatus="in_progress"
            tasks={inProgressTasks}
            allTasks={tasks}
            setTasks={setTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            onInlineCreate={!isMobile ? handleInlineCreate : undefined}
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
          onUpdate={refreshTasks}
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
    </div>
  )
}

// ドラッグ可能なタスクアイテム
function SortableTaskItem({
  task,
  isSelected,
  onSelect,
  onStatusChange,
}: {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      {/* ドラッグハンドル */}
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
      <TaskItem
        task={task}
        isSelected={isSelected}
        onSelect={onSelect}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}

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
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    await onSubmit(title, sectionStatus)
    setTitle("")
    setEditing(false)
    setSubmitting(false)
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
          if (e.key === "Enter") handleSubmit()
          if (e.key === "Escape") { setEditing(false); setTitle("") }
        }}
        disabled={submitting}
      />
      <Button size="sm" className="h-8 shrink-0" onClick={handleSubmit} disabled={!title.trim() || submitting}>
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
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
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
