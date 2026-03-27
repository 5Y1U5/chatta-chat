"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { NotificationInfo } from "@/types/chat"

type Options = {
  userId: string
  onNewNotification: (notification: NotificationInfo) => void
}

/**
 * Notification テーブルの INSERT をリアルタイム購読し、
 * 新通知をコールバックで通知する
 */
export function useRealtimeNotifications({ userId, onNewNotification }: Options) {
  const callbackRef = useRef(onNewNotification)
  callbackRef.current = onNewNotification

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
          const notification: NotificationInfo = {
            id: row.id as string,
            type: row.type as string,
            title: row.title as string,
            taskId: (row.taskId as string) || null,
            projectId: (row.projectId as string) || null,
            read: false,
            createdAt: row.created_at as string,
            actor: {
              id: row.actorId as string,
              displayName: null,
              avatarUrl: null,
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
