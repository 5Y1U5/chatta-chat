"use client"

import { cn } from "@/lib/utils"
import { rruleToText } from "@/lib/recurrence"
import type { TaskInfo } from "@/types/chat"

type Props = {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
}

function formatDueDate(dueDate: string | null): { text: string; className: string } | null {
  if (!dueDate) return null
  // DB の DateTime を "日付のみ" として扱うためローカル日付にパース
  const dueParts = dueDate.slice(0, 10).split("-")
  const dueDay = new Date(Number(dueParts[0]), Number(dueParts[1]) - 1, Number(dueParts[2]))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: "期限切れ", className: "text-red-500 font-medium" }
  if (diffDays === 0) return { text: "今日", className: "text-orange-500 font-medium" }
  if (diffDays === 1) return { text: "明日", className: "text-yellow-600" }
  if (diffDays <= 7) return { text: `${diffDays}日後`, className: "text-muted-foreground" }

  return {
    text: `${dueDay.getMonth() + 1}/${dueDay.getDate()}`,
    className: "text-muted-foreground",
  }
}

export function TaskItem({ task, isSelected, onSelect, onStatusChange }: Props) {
  const dueInfo = formatDueDate(task.dueDate)
  const isDone = task.status === "done"

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDone) {
      onStatusChange(task.id, "todo")
    } else {
      onStatusChange(task.id, "done")
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted border-primary/30"
      )}
      onClick={onSelect}
    >
      {/* チェックボックス */}
      <button
        onClick={handleCheck}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isDone
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/40 hover:border-green-500"
        )}
      >
        {isDone && (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* タスク情報 */}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.project && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-sm"
              style={{
                backgroundColor: task.project.color ? `${task.project.color}20` : undefined,
                color: task.project.color || undefined,
              }}
            >
              {task.project.name}
            </span>
          )}
          {task._count && task._count.subTasks > 0 && (
            <span className="text-[11px] text-muted-foreground">
              サブタスク {task._count.subTasks}
            </span>
          )}
          {task._count && task._count.comments > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {task._count.comments}
            </span>
          )}
        </div>
      </div>

      {/* 繰り返しアイコン */}
      {task.recurrenceRule && (
        <span className="text-xs text-muted-foreground shrink-0" title={rruleToText(task.recurrenceRule)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </span>
      )}

      {/* 期日 */}
      {dueInfo && !isDone && (
        <span className={cn("text-xs shrink-0", dueInfo.className)}>
          {dueInfo.text}
        </span>
      )}

      {/* 優先度 */}
      {task.priority !== "medium" && (
        <span className={cn("text-xs shrink-0", priorityColors[task.priority])}>
          {task.priority === "high" ? "高" : "低"}
        </span>
      )}

      {/* 担当者アバター */}
      {task.assignee && (
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
          title={task.assignee.displayName || ""}
        >
          {task.assignee.displayName?.charAt(0) || "?"}
        </div>
      )}
    </div>
  )
}
