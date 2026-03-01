"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { MessageWithUser, ChannelMemberInfo } from "@/types/chat"

type Options = {
  channelId: string
  parentId?: string | null // スレッド表示時は親メッセージID
  initialMessages: MessageWithUser[]
  userMap: Map<string, ChannelMemberInfo>
}

export function useRealtimeMessages({
  channelId,
  parentId,
  initialMessages,
  userMap,
}: Options) {
  const [messages, setMessages] = useState<MessageWithUser[]>(initialMessages)
  const messageIdsRef = useRef(new Set(initialMessages.map((m) => m.id)))

  // チャンネル/スレッドが変わったらリセット
  useEffect(() => {
    setMessages(initialMessages)
    messageIdsRef.current = new Set(initialMessages.map((m) => m.id))
  }, [channelId, parentId, initialMessages])

  // 過去メッセージを先頭に追加
  const prependMessages = useCallback((older: MessageWithUser[]) => {
    setMessages((prev) => {
      const newIds = new Set(prev.map((m) => m.id))
      const unique = older.filter((m) => !newIds.has(m.id))
      for (const m of unique) {
        messageIdsRef.current.add(m.id)
      }
      return [...unique, ...prev]
    })
  }, [])

  // 楽観的にメッセージを末尾に追加（重複排除用 ID も登録）
  const appendMessage = useCallback((message: MessageWithUser) => {
    if (messageIdsRef.current.has(message.id)) return
    messageIdsRef.current.add(message.id)
    setMessages((prev) => [...prev, message])
  }, [])

  // 新メッセージ追加（INSERT）
  const handleInsert = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const row = payload.new
      const id = row.id as string
      const msgParentId = (row.parent_id as string) || null

      // 重複排除
      if (messageIdsRef.current.has(id)) return

      // スレッド表示中: 対象スレッドの返信のみ追加
      // チャンネル表示中: ルートメッセージのみ追加
      if (parentId) {
        if (msgParentId !== parentId) return
      } else {
        if (msgParentId !== null) {
          // ルートメッセージではないが、親メッセージの返信数を更新
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgParentId
                ? { ...m, replyCount: (m.replyCount || 0) + 1 }
                : m
            )
          )
          return
        }
      }

      messageIdsRef.current.add(id)

      const userId = row.user_id as string
      const userInfo = userMap.get(userId)

      const newMessage: MessageWithUser = {
        id,
        content: row.content as string,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        userId,
        parentId: msgParentId,
        aiGenerated: (row.ai_generated as boolean) || false,
        deletedAt: null,
        replyCount: 0,
        user: {
          id: userId,
          displayName: userInfo?.displayName || "不明",
          avatarUrl: userInfo?.avatarUrl || null,
        },
      }

      setMessages((prev) => [...prev, newMessage])
    },
    [userMap, parentId]
  )

  // メッセージ更新（UPDATE — 編集）
  const handleUpdate = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const row = payload.new
      const id = row.id as string
      const deletedAt = row.deleted_at as string | null

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m
          // ソフトデリートされた場合
          if (deletedAt) {
            return { ...m, deletedAt, content: "このメッセージは削除されました" }
          }
          // 編集された場合
          return {
            ...m,
            content: row.content as string,
            updatedAt: row.updated_at as string,
          }
        })
      )
    },
    []
  )

  useEffect(() => {
    const supabase = createClient()

    const subscription = supabase
      .channel(`messages:${channelId}:${parentId || "root"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `channelId=eq.${channelId}`,
        },
        handleInsert
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Message",
          filter: `channelId=eq.${channelId}`,
        },
        handleUpdate
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [channelId, parentId, handleInsert, handleUpdate])

  return { messages, prependMessages, setMessages, appendMessage }
}
