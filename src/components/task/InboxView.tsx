"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NotificationInfo } from "@/types/chat"

type Props = {
  notifications: NotificationInfo[]
  workspaceId: string
}

const typeIcons: Record<string, string> = {
  task_completed: "完了",
  task_comment: "コメント",
  task_assigned: "割当",
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
    // 既読にする
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

    // タスクページに遷移
    if (notification.taskId) {
      router.push(`/${workspaceId}/tasks`)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold">
          受信トレイ
          {unreadCount > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">({unreadCount}件の未読)</span>
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
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            <p>通知はありません</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                  !n.read && "bg-primary/5"
                )}
                onClick={() => handleClick(n)}
              >
                {/* 未読ドット */}
                <div className="mt-1.5 shrink-0">
                  {!n.read ? (
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <span className="block h-2 w-2" />
                  )}
                </div>

                {/* アクターアバター */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {n.actor.displayName?.charAt(0) || "?"}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {typeIcons[n.type] || n.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
