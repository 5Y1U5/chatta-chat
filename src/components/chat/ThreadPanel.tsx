"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MessageInput } from "@/components/chat/MessageInput"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import type { MessageWithUser, ChannelMemberInfo } from "@/types/chat"

type Props = {
  channelId: string
  parentMessage: MessageWithUser
  members: ChannelMemberInfo[]
  currentUserId: string
  userMap: Map<string, ChannelMemberInfo>
  onClose: () => void
}

export function ThreadPanel({
  channelId,
  parentMessage,
  members,
  currentUserId,
  userMap,
  onClose,
}: Props) {
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [initialReplies, setInitialReplies] = useState<MessageWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // スレッドの返信を初回取得
  useEffect(() => {
    async function fetchReplies() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/internal/messages?channelId=${channelId}&parentId=${parentMessage.id}`
        )
        const data = await res.json()
        setInitialReplies(data.messages || [])
        setHasMore(data.hasMore || false)
      } catch (error) {
        console.error("スレッド返信取得エラー:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchReplies()
  }, [channelId, parentMessage.id])

  const { messages: replies, prependMessages } = useRealtimeMessages({
    channelId,
    parentId: parentMessage.id,
    initialMessages: initialReplies,
    userMap,
  })

  // 初回ロード完了時に最下部にスクロール
  useEffect(() => {
    if (!loading && replies.length > 0) {
      messagesEndRef.current?.scrollIntoView()
    }
  }, [loading, replies.length])

  // 新メッセージ受信時の自動スクロール
  const lastReplyCount = useRef(replies.length)
  useEffect(() => {
    if (replies.length > lastReplyCount.current) {
      const container = scrollContainerRef.current
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
      }
    }
    lastReplyCount.current = replies.length
  }, [replies])

  // 過去メッセージ読み込み
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || replies.length === 0) return
    setLoadingMore(true)

    const container = scrollContainerRef.current
    const prevScrollHeight = container?.scrollHeight || 0

    try {
      const oldest = replies[0]
      const res = await fetch(
        `/api/internal/messages?channelId=${channelId}&parentId=${parentMessage.id}&cursor=${oldest.id}`
      )
      const data = await res.json()

      if (data.messages?.length > 0) {
        prependMessages(data.messages)
        setHasMore(data.hasMore)

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight
          }
        })
      } else {
        setHasMore(false)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, replies, channelId, parentMessage.id, prependMessages])

  // スクロールイベントで上端検出
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    function handleScroll() {
      if (container!.scrollTop < 50) {
        loadMore()
      }
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [loadMore])

  // スレッドに返信
  async function handleSend(content: string) {
    setSending(true)
    try {
      await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          content,
          parentId: parentMessage.id,
        }),
      })
    } catch (error) {
      console.error("スレッド返信エラー:", error)
    } finally {
      setSending(false)
    }
  }

  const parentTime = new Date(parentMessage.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex h-full w-80 flex-col md:w-96">
      {/* ヘッダー */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <span className="font-semibold text-sm">スレッド</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Button>
      </div>

      {/* スレッド内容 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2">
        {/* 親メッセージ */}
        <div className="mb-3 border-b pb-3">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0 mt-0.5">
              <AvatarFallback className="text-xs">
                {parentMessage.user.displayName?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {parentMessage.user.displayName || "不明"}
                </span>
                <span className="text-xs text-muted-foreground">{parentTime}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {parentMessage.content}
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {replies.length} 件の返信
          </div>
        </div>

        {loadingMore && (
          <div className="py-2 text-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        )}

        {loading ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            読み込み中...
          </div>
        ) : (
          replies.map((reply) => (
            <ReplyBubble key={reply.id} message={reply} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 返信入力 */}
      <MessageInput
        channelId={channelId}
        onSend={handleSend}
        disabled={sending}
        placeholder="スレッドに返信..."
      />
    </div>
  )
}

function ReplyBubble({ message }: { message: MessageWithUser }) {
  const time = new Date(message.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const isDeleted = !!message.deletedAt

  return (
    <div className="flex gap-3 py-1.5">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs">
          {message.user.displayName?.charAt(0)?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {message.user.displayName || "不明"}
          </span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">
            このメッセージは削除されました
          </p>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
      </div>
    </div>
  )
}
