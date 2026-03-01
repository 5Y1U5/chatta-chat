"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageInput } from "@/components/chat/MessageInput"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import type { MessageWithUser, ChannelMemberInfo, ChannelInfo } from "@/types/chat"

type Props = {
  channel: ChannelInfo
  initialMessages: MessageWithUser[]
  members: ChannelMemberInfo[]
  currentUserId: string
  workspaceId: string
}

export function MessageView({
  channel,
  initialMessages,
  members,
  currentUserId,
}: Props) {
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  // ユーザーマップ（Realtime で受信したメッセージの送信者情報補完用）
  const userMap = useRef(
    new Map(members.map((m) => [m.id, m]))
  )

  useEffect(() => {
    const currentMember = members.find((m) => m.id === currentUserId)
    if (currentMember) {
      userMap.current.set(currentUserId, currentMember)
    }
  }, [members, currentUserId])

  const { messages, prependMessages } = useRealtimeMessages({
    channelId: channel.id,
    initialMessages,
    userMap: userMap.current,
  })

  // 初回のみ最下部にスクロール
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      isInitialLoad.current = false
    }
  }, [messages])

  // 新メッセージ受信時の自動スクロール（下部付近にいる場合のみ）
  const lastMessageCount = useRef(messages.length)
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      const container = scrollContainerRef.current
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
      }
    }
    lastMessageCount.current = messages.length
  }, [messages])

  // 過去メッセージ読み込み
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)

    const container = scrollContainerRef.current
    const prevScrollHeight = container?.scrollHeight || 0

    try {
      const oldest = messages[0]
      const res = await fetch(
        `/api/internal/messages?channelId=${channel.id}&cursor=${oldest.id}`
      )
      const data = await res.json()

      if (data.messages?.length > 0) {
        prependMessages(data.messages)
        setHasMore(data.hasMore)

        // スクロール位置を維持
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
  }, [loadingMore, hasMore, messages, channel.id, prependMessages])

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

  // チャンネル名の表示
  const channelDisplayName =
    channel.type === "dm"
      ? members.find((m) => m.id !== currentUserId)?.displayName || "DM"
      : `# ${channel.name || "名前なし"}`

  async function handleSend(content: string) {
    setSending(true)
    try {
      await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          content,
        }),
      })
    } catch (error) {
      console.error("メッセージ送信エラー:", error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* チャンネルヘッダー */}
      <div className="flex h-12 items-center border-b px-4 font-semibold">
        {channelDisplayName}
      </div>

      {/* メッセージ一覧 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2">
        {loadingMore && (
          <div className="py-2 text-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            まだメッセージがありません。最初のメッセージを送信しましょう！
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.userId === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <MessageInput
        channelId={channel.id}
        onSend={handleSend}
        disabled={sending}
      />
    </div>
  )
}

function MessageBubble({
  message,
}: {
  message: MessageWithUser
  isOwn: boolean
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex gap-3 py-1.5">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
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
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>
    </div>
  )
}
