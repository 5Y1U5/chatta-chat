"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import type { NotificationInfo } from "@/types/chat"

type Props = {
  notifications: NotificationInfo[]
  workspaceId: string
  currentUserId: string
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
  task_mentioned: {
    label: "メンション",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
  },
}

export function InboxView({ notifications: initial, workspaceId, currentUserId }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [notifications, setNotifications] = useState(initial)

  // 通知のリアルタイム購読
  useRealtimeNotifications({
    userId: currentUserId,
    onNewNotification: useCallback((notification: NotificationInfo) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev
        return [notification, ...prev]
      })
      router.refresh()
    }, [router]),
  })

  const handleMarkAllRead = async () => {
    await fetch("/api/internal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    router.refresh()
  }

  const handleClick = async (notification: NotificationInfo) => {
    if (!notification.read) {
      fetch("/api/internal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }

    // タスクページに遷移（projectId があればプロジェクトビューで開く）
    if (notification.taskId) {
      const params = new URLSearchParams({ taskId: notification.taskId })
      if (notification.projectId) {
        params.set("projectId", notification.projectId)
      }
      router.push(`/${workspaceId}/tasks?${params}`)
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

      <PullToRefresh onRefresh={async () => {
        const res = await fetch("/api/internal/notifications")
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications)
        }
        router.refresh()
      }} className="flex-1">
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
                <div
                  key={n.id}
                  className={cn(
                    "group flex w-full items-start gap-3 text-left hover:bg-muted/50 transition-all duration-200 stagger-item",
                    isMobile ? "px-4 py-4" : "px-4 py-3",
                    !n.read && "bg-primary/5"
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <button className="flex flex-1 items-start gap-3 text-left" onClick={() => handleClick(n)}>
                  {/* 未読ドット */}
                  <div className="mt-2 shrink-0">
                    {!n.read ? (
                      <span className={cn("block rounded-full bg-primary animate-pulse", isMobile ? "h-2.5 w-2.5" : "h-2 w-2")} />
                    ) : (
                      <span className={cn("block", isMobile ? "h-2.5 w-2.5" : "h-2 w-2")} />
                    )}
                  </div>

                  {/* アクターアバター */}
                  <div className={cn(
                    "flex shrink-0 items-center justify-center rounded-full bg-muted font-medium",
                    isMobile ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs"
                  )}>
                    {n.actor.avatarUrl ? (
                      <img src={n.actor.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      n.actor.displayName?.charAt(0) || "?"
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("leading-snug", isMobile ? "text-[15px]" : "text-sm", !n.read && "font-medium")}>{n.title}</p>
                    <div className={cn("flex items-center gap-2", isMobile ? "mt-1.5" : "mt-1")}>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full font-medium",
                        isMobile ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0.5",
                        config.color
                      )}>
                        {config.icon}
                        {config.label}
                      </span>
                      <span className={cn("text-muted-foreground tabular-nums", isMobile ? "text-xs" : "text-[11px]")}>
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

                  {/* アーカイブボタン */}
                  <button
                    className={cn(
                      "mt-2 shrink-0 rounded-md p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors",
                      isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      fetch("/api/internal/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ archiveId: n.id }),
                      })
                      setNotifications((prev) => prev.filter((item) => item.id !== n.id))
                      router.refresh()
                    }}
                    title="アーカイブ"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </PullToRefresh>
    </div>
  )
}
