"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { MessageWithUser, ChannelMemberInfo } from "@/types/chat"

type Options = {
  channelId: string
  initialMessages: MessageWithUser[]
  userMap: Map<string, ChannelMemberInfo>
}

export function useRealtimeMessages({
  channelId,
  initialMessages,
  userMap,
}: Options) {
  const [messages, setMessages] = useState<MessageWithUser[]>(initialMessages)
  const messageIdsRef = useRef(new Set(initialMessages.map((m) => m.id)))

  // チャンネルが変わったらリセット
  useEffect(() => {
    setMessages(initialMessages)
    messageIdsRef.current = new Set(initialMessages.map((m) => m.id))
  }, [channelId, initialMessages])

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

  const addMessage = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const row = payload.new
      const id = row.id as string

      // 重複排除
      if (messageIdsRef.current.has(id)) return

      messageIdsRef.current.add(id)

      const userId = row.user_id as string
      const userInfo = userMap.get(userId)

      const newMessage: MessageWithUser = {
        id,
        content: row.content as string,
        createdAt: row.created_at as string,
        userId,
        user: {
          id: userId,
          displayName: userInfo?.displayName || "不明",
          avatarUrl: userInfo?.avatarUrl || null,
        },
      }

      setMessages((prev) => [...prev, newMessage])
    },
    [userMap]
  )

  useEffect(() => {
    const supabase = createClient()

    const subscription = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `channelId=eq.${channelId}`,
        },
        addMessage
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [channelId, addMessage])

  return { messages, prependMessages }
}
