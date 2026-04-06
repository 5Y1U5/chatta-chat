"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { NotificationInfo } from "@/types/chat"

type MemberLookup = { id: string; displayName: string | null; avatarUrl: string | null }

type Options = {
  userId: string
  onNewNotification: (notification: NotificationInfo) => void
  /** actor 情報補完用のメンバーリスト */
  members?: MemberLookup[]
}

/**
 * Notification テーブルの INSERT をリアルタイム購読し、
 * 新通知をコールバックで通知する
 */
export function useRealtimeNotifications({ userId, onNewNotification, members }: Options) {
  const callbackRef = useRef(onNewNotification)
  callbackRef.current = onNewNotification
  const membersRef = useRef(members)
  membersRef.current = members

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const subscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new
          const actorId = row.actorId as string
          // メンバーリストから actor 情報を補完
          const actor = membersRef.current?.find((m) => m.id === actorId)
          const notification: NotificationInfo = {
            id: row.id as string,
            type: row.type as string,
            title: row.title as string,
            body: (row.body as string) || null,
            taskId: (row.taskId as string) || null,
            projectId: (row.projectId as string) || null,
            read: false,
            createdAt: row.created_at as string,
            actor: {
              id: actorId,
              displayName: actor?.displayName || null,
              avatarUrl: actor?.avatarUrl || null,
            },
          }
          callbackRef.current(notification)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [userId])
}
