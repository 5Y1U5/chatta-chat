"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NotificationInfo } from "@/types/chat"

type Props = {
  notifications: NotificationInfo[]
  workspaceId: string
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  task_completed: {
    label: "完了",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  task_comment: {
    label: "コメント",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  task_assigned: {
    label: "割当",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
}

export function InboxView({ notifications: initial, workspaceId }: Props) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initial)

  const handleMarkAllRead = async () => {
    await fetch("/api/internal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClick = async (notification: NotificationInfo) => {
    if (!notification.read) {
      await fetch("/api/internal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }

    // タスクページに遷移（タスクIDをパラメータで渡して自動選択）
    if (notification.taskId) {
      router.push(`/${workspaceId}/tasks?taskId=${notification.taskId}`)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col h-full page-enter">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold">
          受信トレイ
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({unreadCount}件の未読)</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            すべて既読にする
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground page-enter">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-30">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            <p className="text-sm">通知はありません</p>
            <p className="text-xs mt-1 text-muted-foreground/60">タスクの割当やコメントがあると通知されます</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n, i) => {
              const config = typeConfig[n.type] || { label: n.type, color: "bg-muted text-muted-foreground", icon: null }
              return (
                <button
                  key={n.id}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-all duration-200 stagger-item",
                    !n.read && "bg-primary/5"
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => handleClick(n)}
                >
                  {/* 未読ドット */}
                  <div className="mt-2 shrink-0">
                    {!n.read ? (
                      <span className="block h-2 w-2 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <span className="block h-2 w-2" />
                    )}
                  </div>

                  {/* アクターアバター */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {n.actor.displayName?.charAt(0) || "?"}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.read && "font-medium")}>{n.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium", config.color)}>
                        {config.icon}
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(n.createdAt).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
