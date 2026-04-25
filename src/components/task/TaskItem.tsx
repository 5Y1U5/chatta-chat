"use client"

import { useState, memo, useRef } from "react"
import { cn } from "@/lib/utils"
import { rruleToText } from "@/lib/recurrence"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DueDateDrawer } from "@/components/task/DueDateDrawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ja } from "date-fns/locale"
import type { TaskInfo } from "@/types/chat"

type Props = {
  task: TaskInfo
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (taskId: string, status: string) => void
  onDueDateChange?: (taskId: string, dueDate: string | null) => void
  onStartDateChange?: (taskId: string, startDate: string | null) => void
  onRecurrenceChange?: (taskId: string, recurrenceRule: string | null) => void
  // 複数選択モード
  selectionMode?: boolean
  isChecked?: boolean
  onToggleChecked?: (taskId: string) => void
  onEnterSelectionMode?: (taskId: string) => void
  onArchive?: (taskId: string, archived: boolean) => void
  onDelete?: (taskId: string) => void
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
  if (diffDays === 0) return { text: "今日", className: `bg-blue-500/20 text-blue-500 ${sz}`, isCritical: true }
  if (diffDays === 1) return { text: "明日", className: `text-muted-foreground ${sz} bg-muted`, isCritical: false }
  if (diffDays <= 7) return { text: `${diffDays}日後`, className: `text-muted-foreground ${mobile ? "text-xs" : "text-[11px]"}`, isCritical: false }

  return {
    text: `${dueDay.getMonth() + 1}/${dueDay.getDate()}`,
    className: `text-muted-foreground ${mobile ? "text-xs" : "text-[11px]"}`,
    isCritical: false,
  }
}

function formatDateRange(startDate: string, dueDate: string, mobile: boolean): { text: string; className: string; isCritical: boolean } {
  const parseParts = (d: string) => {
    const p = d.slice(0, 10).split("-")
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  }
  const start = parseParts(startDate)
  const end = parseParts(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endDiff = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const sz = mobile ? "text-xs px-2.5 py-1 rounded-md font-medium" : "text-[11px] px-1.5 py-0.5 rounded font-medium"

  if (endDiff < 0) return { text: `${fmt(start)}→${fmt(end)}`, className: `bg-red-500/20 text-red-400 ${sz}`, isCritical: true }
  if (endDiff === 0) return { text: `${fmt(start)}→今日`, className: `bg-blue-500/20 text-blue-500 ${sz}`, isCritical: true }
  return { text: `${fmt(start)}→${fmt(end)}`, className: `text-muted-foreground ${sz} bg-muted`, isCritical: false }
}

export const TaskItem = memo(function TaskItem({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  onDueDateChange,
  onStartDateChange,
  onRecurrenceChange,
  selectionMode = false,
  isChecked = false,
  onToggleChecked,
  onEnterSelectionMode,
  onArchive,
  onDelete,
}: Props) {
  const isMobile = useIsMobile()
  const dueInfo = task.startDate && task.dueDate
    ? formatDateRange(task.startDate, task.dueDate, isMobile)
    : formatDueDate(task.dueDate, isMobile)
  const isDone = task.status === "done"
  const [celebrating, setCelebrating] = useState(false)
  const [dueDateOpen, setDueDateOpen] = useState(false)
  // DueDateDrawer / DropdownMenu が閉じる際、内部の「完了」タップが裏のタスク行に貫通して
  // 詳細パネルが開いてしまうのを防ぐためのガード（閉じてから一定時間 onClick を無視）
  const ignoreClickUntilRef = useRef(0)

  const handleRowClick = () => {
    if (Date.now() < ignoreClickUntilRef.current) return
    if (selectionMode) {
      onToggleChecked?.(task.id)
      return
    }
    onSelect()
  }

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectionMode) {
      onToggleChecked?.(task.id)
      return
    }
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

  // 行末の「⋯」メニュー（モバイル：常時表示・PC：ホバー時表示）
  const handleMenuOpenChange = (open: boolean) => {
    if (!open) {
      // メニューを閉じた直後の bubbling click を抑止
      ignoreClickUntilRef.current = Date.now() + 400
    }
  }
  const renderMenu = () => (
    <DropdownMenu onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="その他のアクション"
          className={cn(
            "shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            isMobile ? "h-8 w-8" : "h-7 w-7 opacity-0 group-hover:opacity-100"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? 18 : 16} height={isMobile ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onEnterSelectionMode && (
          <DropdownMenuItem onClick={() => onEnterSelectionMode(task.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            選択
          </DropdownMenuItem>
        )}
        {onArchive && (
          <DropdownMenuItem onClick={() => onArchive(task.id, !task.archived)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            {task.archived ? "アーカイブ解除" : "アーカイブ"}
          </DropdownMenuItem>
        )}
        {(onEnterSelectionMode || onArchive) && onDelete && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            削除
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // モバイル: Asana ライクなシンプルレイアウト（タイトル + 期日バッジ）
  if (isMobile) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 border-b border-border/50 cursor-pointer transition-colors duration-150",
          "px-4 py-4",
          "hover:bg-muted/30",
          isSelected && "bg-muted/50",
          selectionMode && isChecked && "bg-blue-500/10",
          celebrating && "bg-blue-50 dark:bg-blue-950/20"
        )}
        onClick={handleRowClick}
      >
        {/* 左端の優先度カラーバー */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-opacity",
            priorityBarColors[task.priority] || "bg-transparent",
            task.priority === "medium" && "opacity-0"
          )}
        />

        {/* チェックボックス（選択モード中は四角・通常は丸） */}
        <button
          onClick={handleCheck}
          aria-label={selectionMode ? (isChecked ? "選択解除" : "選択") : "完了切替"}
          className={cn(
            "flex shrink-0 items-center justify-center transition-all duration-200",
            selectionMode
              ? cn(
                  "h-6 w-6 rounded-md border-2",
                  isChecked
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-muted-foreground/40 active:scale-90"
                )
              : cn(
                  "h-7 w-7 rounded-full border-2",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary active:scale-90",
                  celebrating && "animate-bounce border-primary bg-primary text-primary-foreground"
                )
          )}
        >
          {selectionMode
            ? isChecked && (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )
            : (isDone || celebrating) && (
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

        {/* 期日バッジ（タップでボトムシート表示） — 選択モード中は非表示 */}
        {!isDone && !selectionMode && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDueDateOpen(true)
              }}
              className={cn(
                "shrink-0",
                dueInfo
                  ? dueInfo.className
                  : "text-xs px-2.5 py-1 rounded-md text-muted-foreground/50"
              )}
            >
              {dueInfo ? dueInfo.text : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              )}
            </button>
            <DueDateDrawer
              open={dueDateOpen}
              onOpenChange={(open) => {
                setDueDateOpen(open)
                if (!open) {
                  // Drawer が閉じる瞬間に裏の TaskItem に通る click を一定時間ブロック
                  ignoreClickUntilRef.current = Date.now() + 600
                }
              }}
              value={task.dueDate ? (() => {
                const parts = task.dueDate!.slice(0, 10).split("-")
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
              })() : undefined}
              startDate={task.startDate ? (() => {
                const parts = task.startDate!.slice(0, 10).split("-")
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
              })() : undefined}
              recurrenceRule={task.recurrenceRule}
              onConfirm={(date, opts) => {
                const dateToStr = (d: Date) => {
                  const yyyy = d.getFullYear()
                  const mm = String(d.getMonth() + 1).padStart(2, "0")
                  const dd = String(d.getDate()).padStart(2, "0")
                  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`
                }
                if (onDueDateChange) {
                  onDueDateChange(task.id, date ? dateToStr(date) : null)
                }
                if (onStartDateChange && opts) {
                  const newStart = opts.startDate ? dateToStr(opts.startDate) : null
                  if (newStart !== (task.startDate || null)) {
                    onStartDateChange(task.id, newStart)
                  }
                }
                if (onRecurrenceChange && opts && opts.recurrenceRule !== (task.recurrenceRule || null)) {
                  onRecurrenceChange(task.id, opts.recurrenceRule ?? null)
                }
              }}
            />
          </>
        )}

        {/* 「⋯」メニュー（選択モード中は非表示・menu props 未指定時も非表示） */}
        {!selectionMode && (onEnterSelectionMode || onArchive || onDelete) && renderMenu()}
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
        selectionMode && isChecked && "bg-blue-500/10",
        celebrating && "bg-blue-50 dark:bg-blue-950/20"
      )}
      onClick={handleRowClick}
    >
      {/* 左端の優先度カラーバー */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-opacity",
          priorityBarColors[task.priority] || "bg-transparent",
          task.priority === "medium" && "opacity-0"
        )}
      />

      {/* チェックボックス（選択モード中は四角・通常は丸） */}
      <button
        onClick={handleCheck}
        aria-label={selectionMode ? (isChecked ? "選択解除" : "選択") : "完了切替"}
        className={cn(
          "flex shrink-0 items-center justify-center transition-all duration-200",
          selectionMode
            ? cn(
                "h-5 w-5 rounded border-2",
                isChecked
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-muted-foreground/40 hover:border-blue-500"
              )
            : cn(
                "h-5 w-5 rounded-full border-2",
                isDone
                  ? "border-primary bg-primary text-primary-foreground scale-110"
                  : "border-muted-foreground/40 hover:border-primary hover:scale-110 active:scale-90",
                celebrating && "animate-bounce border-primary bg-primary text-primary-foreground"
              )
        )}
      >
        {selectionMode
          ? isChecked && (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )
          : (isDone || celebrating) && (
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

      {/* 「⋯」メニュー（選択モード中は非表示・menu props 未指定時も非表示） */}
      {!selectionMode && (onEnterSelectionMode || onArchive || onDelete) && renderMenu()}
    </div>
  )
})
