"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TaskItem } from "@/components/task/TaskItem"
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel"
import { CreateTaskDialog } from "@/components/task/CreateTaskDialog"
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
}: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const todoTasks = tasks.filter((t) => t.status === "todo")
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress")
  const doneTasks = tasks.filter((t) => t.status === "done")

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
      router.refresh()
    }
  }

  const handleTaskCreated = async () => {
    await refreshTasks()
    setCreateOpen(false)
    router.refresh()
  }

  const title = viewMode === "my-tasks" ? "マイタスク" : projectName || "プロジェクト"

  return (
    <div className="flex h-full">
      {/* タスクリスト */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            タスクを追加
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 未着手 */}
          <TaskSection
            label="未着手"
            tasks={todoTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
          />

          {/* 進行中 */}
          <TaskSection
            label="進行中"
            tasks={inProgressTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
          />

          {/* 完了 */}
          <TaskSection
            label="完了"
            tasks={doneTasks}
            onSelect={setSelectedTaskId}
            selectedId={selectedTaskId}
            onStatusChange={handleStatusChange}
            defaultCollapsed
          />

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <p>タスクはまだありません</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                最初のタスクを作成
              </Button>
            </div>
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

      {/* タスク作成ダイアログ */}
      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleTaskCreated}
        projects={projects}
        members={members}
        defaultProjectId={projectId}
        workspaceId={workspaceId}
      />
    </div>
  )
}

function TaskSection({
  label,
  tasks,
  onSelect,
  selectedId,
  onStatusChange,
  defaultCollapsed = false,
}: {
  label: string
  tasks: TaskInfo[]
  onSelect: (id: string) => void
  selectedId: string | null
  onStatusChange: (taskId: string, status: string) => void
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (tasks.length === 0 && defaultCollapsed) return null

  return (
    <div>
      <button
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
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
        {label}
        <span className="text-xs">({tasks.length})</span>
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={selectedId === task.id}
              onSelect={() => onSelect(task.id)}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
