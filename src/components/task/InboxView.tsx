"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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
  task_collaborator: {
    label: "コラボレーター",
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  project_invited: {
    label: "招待",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
}

// スワイプ可能な通知行
function SwipeableNotificationRow({
  notification,
  onArchive,
  onTap,
  index,
  expanded,
  onToggleExpand,
}: {
  notification: NotificationInfo
  onArchive: (id: string) => void
  onTap: (n: NotificationInfo) => void
  index: number
  expanded: boolean
  onToggleExpand: (id: string) => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [removing, setRemoving] = useState(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const swipingRef = useRef(false)
  const lockedRef = useRef(false) // スワイプ方向確定済み
  const rowRef = useRef<HTMLDivElement>(null)

  const REVEAL_THRESHOLD = 80
  const AUTO_ARCHIVE_THRESHOLD = 160

  const config = typeConfig[notification.type] || { label: notification.type, color: "bg-muted text-muted-foreground", icon: null }

  const handleStart = (clientX: number, clientY: number) => {
    startXRef.current = clientX
    startYRef.current = clientY
    swipingRef.current = true
    lockedRef.current = false
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!swipingRef.current) return

    const dx = clientX - startXRef.current
    const dy = clientY - startYRef.current

    // 方向がまだ確定していない場合、垂直スクロール優先判定
    if (!lockedRef.current) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        // 縦方向 → スワイプキャンセル（スクロールに任せる）
        swipingRef.current = false
        setOffsetX(0)
        return
      }
      if (Math.abs(dx) > 8) {
        lockedRef.current = true
      } else {
        return
      }
    }

    // 左方向（マイナス）のみ許可
    if (dx < 0) {
      setOffsetX(Math.max(dx * 0.8, -200))
    } else {
      setOffsetX(0)
    }
  }

  const handleEnd = () => {
    if (!swipingRef.current) return
    swipingRef.current = false

    if (Math.abs(offsetX) >= AUTO_ARCHIVE_THRESHOLD) {
      // 自動アーカイブ
      setRemoving(true)
      setTimeout(() => onArchive(notification.id), 200)
    } else if (Math.abs(offsetX) >= REVEAL_THRESHOLD) {
      // スナップしてボタン露出
      setOffsetX(-REVEAL_THRESHOLD)
    } else {
      setOffsetX(0)
    }
  }

  // PC用: マウスイベント
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
    const onMouseMove = (ev: MouseEvent) => handleMove(ev.clientX, ev.clientY)
    const onMouseUp = () => {
      handleEnd()
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative overflow-hidden stagger-item",
        removing && "transition-all duration-200 h-0 opacity-0"
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* アーカイブ背景（右端に表示） */}
      <div className="absolute inset-y-0 right-0 flex items-center bg-destructive text-destructive-foreground" style={{ width: Math.max(Math.abs(offsetX), 0) }}>
        <div className="flex items-center gap-2 px-4 ml-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {Math.abs(offsetX) >= AUTO_ARCHIVE_THRESHOLD && (
            <span className="text-xs font-medium whitespace-nowrap">アーカイブ</span>
          )}
        </div>
      </div>

      {/* メインコンテンツ（スライドする行） */}
      <div
        className={cn(
          "relative flex items-center gap-3 border-b bg-background cursor-pointer select-none",
          "px-4 py-3",
          !notification.read && "bg-primary/5",
          offsetX === 0 && "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}
        onMouseDown={handleMouseDown}
        onClick={() => {
          if (Math.abs(offsetX) > 5) {
            // スワイプ中はクリック無効、元に戻す
            setOffsetX(0)
            return
          }
          onTap(notification)
        }}
      >
        {/* 未読ドット */}
        <div className="shrink-0">
          {!notification.read ? (
            <span className="block h-2 w-2 rounded-full bg-primary" />
          ) : (
            <span className="block h-2 w-2" />
          )}
        </div>

        {/* アクターアバター */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {notification.actor.avatarUrl ? (
            <img src={notification.actor.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            notification.actor.displayName?.charAt(0) || "?"
          )}
        </div>

        {/* 通知内容 */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm leading-snug", !notification.read && "font-medium", expanded ? "" : "line-clamp-2")}>
            {notification.title}
          </p>
          {notification.body && (
            <p className={cn("text-xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-wrap", expanded ? "" : "line-clamp-3")}>
              {notification.body}
            </p>
          )}
          {/* もっと見る / 折りたたむ */}
          {notification.body && notification.body.length > 80 && (
            <button
              className="text-xs text-primary mt-1 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand(notification.id)
              }}
            >
              {expanded ? "折りたたむ" : "もっと見る"}
            </button>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full text-[10px] px-1.5 py-0.5 font-medium", config.color)}>
              {config.icon}
              {config.label}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
        </div>

        {/* 右矢印（タップ可能のヒント） */}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

// 相対時刻表示
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "たった今"
  if (min < 60) return `${min}分前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}日前`
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
}

// 通知詳細パネル
function NotificationDetailPanel({
  notification,
  workspaceId,
  onClose,
  onArchive,
}: {
  notification: NotificationInfo
  workspaceId: string
  onClose: () => void
  onArchive: (id: string) => void
}) {
  const router = useRouter()
  const config = typeConfig[notification.type] || { label: notification.type, color: "bg-muted text-muted-foreground", icon: null }
  const [replyText, setReplyText] = useState("")
  const [replySending, setReplySending] = useState(false)
  const [replySent, setReplySent] = useState(false)

  const isCommentNotification = notification.type === "task_comment" && notification.taskId

  const handleReply = async () => {
    if (!replyText.trim() || !notification.taskId) return
    setReplySending(true)
    try {
      const res = await fetch("/api/internal/tasks/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: notification.taskId, content: replyText.trim() }),
      })
      if (res.ok) {
        setReplyText("")
        setReplySent(true)
        setTimeout(() => setReplySent(false), 2000)
      }
    } finally {
      setReplySending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />

      {/* パネル */}
      <div
        className="relative w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-200 safe-area-bottom max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ハンドル（モバイル） */}
        <div className="sm:hidden flex justify-center mb-4">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {notification.actor.avatarUrl ? (
              <img src={notification.actor.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              notification.actor.displayName?.charAt(0) || "?"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{notification.actor.displayName || "メンバー"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("inline-flex items-center gap-1 rounded-full text-[10px] px-1.5 py-0.5 font-medium", config.color)}>
                {config.icon}
                {config.label}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {new Date(notification.createdAt).toLocaleString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 本文 */}
        <p className="text-sm leading-relaxed">{notification.title}</p>
        {notification.body && (
          <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{notification.body}</p>
          </div>
        )}

        {/* コメント返信フォーム */}
        {isCommentNotification && (
          <div className="mt-3">
            {replySent ? (
              <p className="text-sm text-primary">返信を送信しました</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleReply() }}
                  placeholder="返信を入力..."
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={replySending}
                />
                <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || replySending}>
                  {replySending ? "..." : "送信"}
                </Button>
              </div>
            )}
          </div>
        )}
        <div className="mb-6" />

        {/* アクションボタン */}
        <div className="flex gap-2">
          {notification.taskId ? (
            <Button
              className="flex-1"
              onClick={() => {
                onClose()
                const params = new URLSearchParams({ taskId: notification.taskId! })
                if (notification.projectId) params.set("projectId", notification.projectId)
                router.push(`/${workspaceId}/tasks?${params}`)
              }}
            >
              タスクを確認する
            </Button>
          ) : notification.projectId ? (
            <Button
              className="flex-1"
              onClick={() => {
                onClose()
                router.push(`/${workspaceId}/tasks?projectId=${notification.projectId}`)
              }}
            >
              プロジェクトを確認する
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              onArchive(notification.id)
              onClose()
            }}
          >
            アーカイブ
          </Button>
        </div>
      </div>
    </div>
  )
}

export function InboxView({ notifications: initial, workspaceId, currentUserId }: Props) {
  const [notifications, setNotifications] = useState(initial)
  const [selectedNotification, setSelectedNotification] = useState<NotificationInfo | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [members, setMembers] = useState<{ id: string; displayName: string | null; avatarUrl: string | null }[]>([])

  // Server Component から新��い initial が来たら同期（ページ再訪問時）
  useEffect(() => {
    setNotifications(initial)
  }, [initial])

  // メンバー���ストを1回取得（actor 情報補完用）
  useEffect(() => {
    fetch("/api/internal/members?includeSelf=true")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setMembers(data))
      .catch(() => {})
  }, [])

  // 通知のリアルタイム購読
  useRealtimeNotifications({
    userId: currentUserId,
    members,
    onNewNotification: useCallback((notification: NotificationInfo) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev
        return [notification, ...prev]
      })
    }, []),
  })

  const handleMarkAllRead = async () => {
    // 楽観的更新: ローカル state のみ更新（router.refresh() は state リセットを引き起こすため使わない）
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await fetch("/api/internal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  const handleArchive = useCallback((id: string) => {
    // 楽観的更新: 即座にローカルから除去
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    fetch("/api/internal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId: id }),
    })
  }, [])

  const handleTap = useCallback((n: NotificationInfo) => {
    // 楽観的更新: 即座に既読表示
    if (!n.read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      )
      fetch("/api/internal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: n.id }),
      })
    }
    setSelectedNotification(n)
  }, [])

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
          <div>
            {notifications.map((n, i) => (
              <SwipeableNotificationRow
                key={n.id}
                notification={n}
                onArchive={handleArchive}
                onTap={handleTap}
                index={i}
                expanded={expandedIds.has(n.id)}
                onToggleExpand={(id) => setExpandedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })}
              />
            ))}
          </div>
        )}
      </PullToRefresh>

      {/* 通知詳細パネル */}
      {selectedNotification && (
        <NotificationDetailPanel
          notification={selectedNotification}
          workspaceId={workspaceId}
          onClose={() => setSelectedNotification(null)}
          onArchive={handleArchive}
        />
      )}
    </div>
  )
}
