"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageInput, type FileAttachment } from "@/components/chat/MessageInput"
import { ThreadPanel } from "@/components/chat/ThreadPanel"
import { EmojiPicker } from "@/components/chat/EmojiPicker"
import { TypingIndicator } from "@/components/chat/TypingIndicator"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useTypingIndicator } from "@/hooks/useTypingIndicator"
import { ChannelMembersDialog } from "@/components/chat/ChannelMembersDialog"
import type { MessageWithUser, ChannelMemberInfo, ChannelInfo, ReactionInfo } from "@/types/chat"

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
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
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

  const { messages, prependMessages, setMessages, appendMessage } = useRealtimeMessages({
    channelId: channel.id,
    initialMessages,
    userMap: userMap.current,
  })

  const currentDisplayName = members.find((m) => m.id === currentUserId)?.displayName || "不明"
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    channel.id,
    currentUserId,
    currentDisplayName
  )

  // 初回のみ最下部にスクロール + 既読マーク
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      isInitialLoad.current = false

      // チャンネルを開いた時に既読マーク
      fetch("/api/internal/channels/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id }),
      }).catch(() => {})
    }
  }, [messages, channel.id])

  // 新メッセージ受信時の自動スクロール + 既読更新
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

      // 表示中のチャンネルなので既読を更新
      fetch("/api/internal/channels/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id }),
      }).catch(() => {})
    }
    lastMessageCount.current = messages.length
  }, [messages, channel.id])

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

  async function handleSend(content: string, file?: FileAttachment) {
    stopTyping()
    setSending(true)
    try {
      const res = await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          content,
          ...(file ? { fileUrl: file.fileUrl, fileName: file.fileName, fileType: file.fileType } : {}),
        }),
      })
      const data = await res.json()

      if (data.id) {
        // 楽観的更新: Realtime を待たずに即座にメッセージを表示
        const currentUser = members.find((m) => m.id === currentUserId)
        const now = new Date().toISOString()
        const optimisticMessage: MessageWithUser = {
          id: data.id,
          content: content || (file ? `[ファイル] ${file.fileName}` : ""),
          createdAt: now,
          updatedAt: now,
          userId: currentUserId,
          parentId: null,
          aiGenerated: false,
          deletedAt: null,
          replyCount: 0,
          fileUrl: file?.fileUrl || null,
          fileName: file?.fileName || null,
          fileType: file?.fileType || null,
          reactions: [],
          user: {
            id: currentUserId,
            displayName: currentUser?.displayName || "不明",
            avatarUrl: currentUser?.avatarUrl || null,
          },
        }
        appendMessage(optimisticMessage)

        // 最下部にスクロール
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        })
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error)
    } finally {
      setSending(false)
    }
  }

  // メッセージ編集
  async function handleEdit(messageId: string, newContent: string) {
    try {
      await fetch("/api/internal/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content: newContent }),
      })
    } catch (error) {
      console.error("メッセージ編集エラー:", error)
    }
  }

  // メッセージ削除
  async function handleDelete(messageId: string) {
    try {
      await fetch(`/api/internal/messages?messageId=${messageId}`, {
        method: "DELETE",
      })
    } catch (error) {
      console.error("メッセージ削除エラー:", error)
    }
  }

  // リアクショントグル
  async function handleReaction(messageId: string, emoji: string) {
    try {
      const res = await fetch("/api/internal/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      })
      const data = await res.json()

      // 楽観的更新
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const reactions = [...(m.reactions || [])]
          const idx = reactions.findIndex((r) => r.emoji === emoji)

          if (data.action === "added") {
            if (idx >= 0) {
              reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userReacted: true }
            } else {
              reactions.push({ emoji, count: 1, userReacted: true })
            }
          } else {
            if (idx >= 0) {
              if (reactions[idx].count <= 1) {
                reactions.splice(idx, 1)
              } else {
                reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, userReacted: false }
              }
            }
          }

          return { ...m, reactions }
        })
      )
    } catch (error) {
      console.error("リアクションエラー:", error)
    }
  }

  // アクティブスレッドの親メッセージ
  const activeThreadMessage = activeThreadId
    ? messages.find((m) => m.id === activeThreadId)
    : null

  return (
    <div className="flex min-h-0 flex-1">
      {/* メインチャットエリア */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${activeThreadId ? "border-r" : ""}`}>
        {/* チャンネルヘッダー */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-4 font-semibold">
          <span>{channelDisplayName}</span>
          <ChannelMembersDialog
            channelId={channel.id}
            channelType={channel.type}
            currentUserId={currentUserId}
          />
        </div>

        {/* メッセージ一覧 */}
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
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
                onReply={() => setActiveThreadId(message.id)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReaction={handleReaction}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* タイピングインジケータ */}
        <TypingIndicator typingUsers={typingUsers} />

        {/* 入力エリア */}
        <MessageInput
          channelId={channel.id}
          onSend={handleSend}
          disabled={sending}
          members={members}
          onTyping={startTyping}
        />
      </div>

      {/* スレッドパネル */}
      {activeThreadId && activeThreadMessage && (
        <ThreadPanel
          channelId={channel.id}
          parentMessage={activeThreadMessage}
          members={members}
          currentUserId={currentUserId}
          userMap={userMap.current}
          onClose={() => setActiveThreadId(null)}
        />
      )}
    </div>
  )
}

// メッセージバブル
function MessageBubble({
  message,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onReaction,
}: {
  message: MessageWithUser
  isOwn: boolean
  onReply: () => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onReaction: (messageId: string, emoji: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const time = new Date(message.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const isEdited =
    message.updatedAt &&
    message.createdAt !== message.updatedAt &&
    !message.deletedAt

  const isDeleted = !!message.deletedAt

  function handleSaveEdit() {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed)
    }
    setEditing(false)
  }

  function handleKeyDownEdit(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    }
    if (e.key === "Escape") {
      setEditing(false)
      setEditContent(message.content)
    }
  }

  return (
    <div
      className="group relative flex gap-3 py-1.5 hover:bg-muted/50 rounded-md px-1 -mx-1"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className={`text-xs ${message.aiGenerated ? "bg-violet-200 text-violet-700 dark:bg-violet-900 dark:text-violet-300" : ""}`}>
          {message.aiGenerated ? "AI" : (message.user.displayName?.charAt(0)?.toUpperCase() || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {message.user.displayName || "不明"}
          </span>
          {message.aiGenerated && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              AI
            </span>
          )}
          <span className="text-xs text-muted-foreground">{time}</span>
          {isEdited && (
            <span className="text-xs text-muted-foreground">（編集済み）</span>
          )}
        </div>

        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">
            このメッセージは削除されました
          </p>
        ) : editing ? (
          <div className="mt-1 space-y-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDownEdit}
              className="min-h-[36px] max-h-[120px] resize-none text-sm"
              rows={1}
              autoFocus
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditContent(message.content) }}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                保存
              </Button>
            </div>
          </div>
        ) : (
          <>
            {message.content && !message.fileUrl && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
            {message.content && message.fileUrl && !message.content.startsWith("[ファイル]") && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </>
        )}

        {/* ファイル添付表示 */}
        {!isDeleted && message.fileUrl && (
          <FilePreview
            fileUrl={message.fileUrl}
            fileName={message.fileName || "ファイル"}
            fileType={message.fileType || ""}
          />
        )}

        {/* リアクション表示 */}
        {!isDeleted && message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReaction(message.id, r.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted ${
                  r.userReacted ? "border-primary/50 bg-primary/10" : "border-border"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-muted-foreground">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* 返信数バッジ */}
        {!isDeleted && (message.replyCount || 0) > 0 && (
          <button
            onClick={onReply}
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {message.replyCount} 件の返信
          </button>
        )}
      </div>

      {/* アクションメニュー */}
      {showActions && !isDeleted && !editing && (
        <div className="absolute -top-3 right-1 flex gap-0.5 rounded-md border bg-background shadow-sm">
          {/* リアクション */}
          <div className="relative">
            <ActionButton title="リアクション" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </ActionButton>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => onReaction(message.id, emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
          <ActionButton title="返信" onClick={onReply}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </ActionButton>
          {isOwn && (
            <ActionButton title="編集" onClick={() => { setEditing(true); setEditContent(message.content) }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </ActionButton>
          )}
          {isOwn && (
            <ActionButton title="削除" onClick={() => onDelete(message.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </ActionButton>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  )
}

// ファイルプレビュー
function FilePreview({
  fileUrl,
  fileName,
  fileType,
}: {
  fileUrl: string
  fileName: string
  fileType: string
}) {
  const isImage = fileType.startsWith("image/")

  if (isImage) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block">
        <img
          src={fileUrl}
          alt={fileName}
          className="max-h-64 max-w-xs rounded-md border object-contain"
          loading="lazy"
        />
      </a>
    )
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="truncate">{fileName}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  )
}
