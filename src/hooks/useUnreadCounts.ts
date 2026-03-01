"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

type ChannelUnread = {
  channelId: string
  count: number
}

// チャンネルごとの未読数をリアルタイムで管理
export function useUnreadCounts(
  initialCounts: ChannelUnread[],
  activeChannelId: string | undefined,
  channelIds: string[]
) {
  const [counts, setCounts] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>()
    for (const c of initialCounts) {
      map.set(c.channelId, c.count)
    }
    return map
  })

  // サーバーから渡された初期値が変わったら同期
  useEffect(() => {
    const map = new Map<string, number>()
    for (const c of initialCounts) {
      map.set(c.channelId, c.count)
    }
    setCounts(map)
  }, [initialCounts])

  // アクティブチャンネルの未読数をクリア
  useEffect(() => {
    if (!activeChannelId) return
    setCounts((prev) => {
      if (!prev.has(activeChannelId) || prev.get(activeChannelId) === 0) return prev
      const next = new Map(prev)
      next.set(activeChannelId, 0)
      return next
    })
  }, [activeChannelId])

  // Realtime: 新メッセージ受信で未読数をインクリメント
  const handleInsert = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const row = payload.new
      const channelId = row.channel_id as string
      const parentId = row.parent_id as string | null

      // ルートメッセージのみカウント
      if (parentId) return
      // 自分が閲覧中のチャンネルはカウントしない
      if (channelId === activeChannelId) return
      // 自分が所属しているチャンネルのみ
      if (!channelIds.includes(channelId)) return

      setCounts((prev) => {
        const next = new Map(prev)
        next.set(channelId, (next.get(channelId) || 0) + 1)
        return next
      })
    },
    [activeChannelId, channelIds]
  )

  useEffect(() => {
    if (channelIds.length === 0) return

    const supabase = createClient()

    const subscription = supabase
      .channel("unread-counts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
        },
        handleInsert
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [channelIds, handleInsert])

  return counts
}
