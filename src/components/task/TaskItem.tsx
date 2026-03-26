"use client"

import { useState, memo } from "react"
import { cn } from "@/lib/utils"
import { rruleToText } from "@/lib/recurrence"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { TaskInfo } from "@/types/chat"

type Props = {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
}

const priorityBarColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
}

function formatDueDate(dueDate: string | null, mobile: boolean): { text: string; className: string; isCritical: boolean } | null {
  if (!dueDate) return null
  // DB の DateTime を "日付のみ" として扱うためローカル日付にパース
  const dueParts = dueDate.slice(0, 10).split("-")
  const dueDay = new Date(Number(dueParts[0]), Number(dueParts[1]) - 1, Number(dueParts[2]))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // モバイル: Asana ライクなバッジスタイル（大きめ・角丸・パディング広め）
  const sz = mobile ? "text-xs px-2.5 py-1 rounded-md font-medium" : "text-[11px] px-1.5 py-0.5 rounded font-medium"

  if (diffDays < 0) return { text: mobile ? "昨日" : "期限切れ", className: `bg-red-500/20 text-red-400 ${sz}`, isCritical: true }
  if (diffDays === 0) return { text: "今日", className: `bg-red-500/20 text-red-400 ${sz}`, isCritical: true }
  if (diffDays === 1) return { text: "明日", className: `bg-orange-500/20 text-orange-400 ${sz}`, isCritical: false }
  if (diffDays <= 7) return { text: `${diffDays}日後`, className: `text-muted-foreground ${mobile ? "text-xs" : "text-[11px]"}`, isCritical: false }

  return {
    text: `${dueDay.getMonth() + 1}/${dueDay.getDate()}`,
    className: `text-muted-foreground ${mobile ? "text-xs" : "text-[11px]"}`,
    isCritical: false,
  }
}

export const TaskItem = memo(function TaskItem({ task, isSelected, onSelect, onStatusChange }: Props) {
  const isMobile = useIsMobile()
  const dueInfo = formatDueDate(task.dueDate, isMobile)
  const isDone = task.status === "done"
  const [celebrating, setCelebrating] = useState(false)

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDone) {
      onStatusChange(task.id, "todo")
    } else {
      setCelebrating(true)
      setTimeout(() => {
        onStatusChange(task.id, "done")
        setCelebrating(false)
      }, 400)
    }
  }

  // モバイル: Asana ライクなシンプルレイアウト（タイトル + 期日バッジ）
  if (isMobile) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-4 border-b border-border/50 cursor-pointer transition-colors duration-150",
          "px-4 py-4",
          "hover:bg-muted/30",
          isSelected && "bg-muted/50",
          celebrating && "bg-blue-50 dark:bg-blue-950/20"
        )}
        onClick={onSelect}
      >
        {/* 左端の優先度カラーバー */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-opacity",
            priorityBarColors[task.priority] || "bg-transparent",
            task.priority === "medium" && "opacity-0"
          )}
        />

        {/* チェックボックス（大きめ） */}
        <button
          onClick={handleCheck}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary active:scale-90",
            celebrating && "animate-bounce border-primary bg-primary text-primary-foreground"
          )}
        >
          {(isDone || celebrating) && (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        <div className={cn(
          "flex-1 min-w-0 text-[17px] truncate transition-all duration-300",
          isDone && "line-through text-muted-foreground",
          celebrating && "line-through text-primary dark:text-primary"
        )}>
          {task.title}
        </div>

        {/* 繰り返しアイコン */}
        {task.recurrenceRule && !isDone && (
          <span className="text-muted-foreground shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </span>
        )}

        {/* 期日バッジ（右端に大きく） */}
        {dueInfo && !isDone && (
          <span className={cn("shrink-0", dueInfo.className)}>
            {dueInfo.text}
          </span>
        )}
      </div>
    )
  }

  // PC: 従来のレイアウト
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border-b border-border/50 px-3 py-2.5 cursor-pointer transition-colors duration-150",
        "hover:bg-muted/30",
        isSelected && "bg-muted/50",
        celebrating && "bg-blue-50 dark:bg-blue-950/20"
      )}
      onClick={onSelect}
    >
      {/* 左端の優先度カラーバー */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-opacity",
          priorityBarColors[task.priority] || "bg-transparent",
          task.priority === "medium" && "opacity-0"
        )}
      />

      {/* チェックボックス */}
      <button
        onClick={handleCheck}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          isDone
            ? "border-primary bg-primary text-primary-foreground scale-110"
            : "border-muted-foreground/40 hover:border-primary hover:scale-110 active:scale-90",
          celebrating && "animate-bounce border-primary bg-primary text-primary-foreground"
        )}
      >
        {(isDone || celebrating) && (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* タスク情報 */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm truncate transition-all duration-300",
          isDone && "line-through text-muted-foreground",
          celebrating && "line-through text-primary dark:text-primary"
        )}>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-0.5">
                <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
              </svg>
              {task._count.subTasks}
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
          {task._count && (task._count as Record<string, number>).members > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {(task._count as Record<string, number>).members}
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

      {/* 期日バッジ */}
      {dueInfo && !isDone && (
        <span className={cn("shrink-0", dueInfo.className)}>
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
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium overflow-hidden",
            !task.assignee.avatarUrl && "bg-muted"
          )}
          title={task.assignee.displayName || ""}
        >
          {task.assignee.avatarUrl ? (
            <img
              src={task.assignee.avatarUrl}
              alt={task.assignee.displayName || ""}
              className="h-full w-full object-cover"
            />
          ) : (
            task.assignee.displayName?.charAt(0) || "?"
          )}
        </div>
      )}
    </div>
  )
})
