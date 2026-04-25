"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { NotificationInfo } from "@/types/chat"

type MemberLookup = { id: string; displayName: string | null; avatarUrl: string | null }

type NotificationChange = {
  read?: boolean
  archived?: boolean
}

type Options = {
  userId: string
  onNewNotification: (notification: NotificationInfo) => void
  /** 既読化・アーカイブ等の更新を受信したときに呼ばれる（他端末・他タブ対応） */
  onNotificationUpdate?: (id: string, change: NotificationChange) => void
  /** actor 情報補完用のメンバーリスト */
  members?: MemberLookup[]
}

/**
 * Notification テーブルの INSERT / UPDATE をリアルタイム購読し、
 * 新通知・既読化・アーカイブをコールバックで通知する。
 *
 * DELETE は対象外: 通常運用ではアーカイブ（archived=true の UPDATE）であり、
 * 物理削除は CASCADE 経由のレアケースのみ。
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
  onNotificationUpdate,
  members,
}: Options) {
  const newCallbackRef = useRef(onNewNotification)
  newCallbackRef.current = onNewNotification
  const updateCallbackRef = useRef(onNotificationUpdate)
  updateCallbackRef.current = onNotificationUpdate
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
            read: (row.read as boolean) ?? false,
            createdAt: row.createdAt as string,
            actor: {
              id: actorId,
              displayName: actor?.displayName || null,
              avatarUrl: actor?.avatarUrl || null,
            },
          }
          newCallbackRef.current(notification)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new
          const id = row.id as string
          updateCallbackRef.current?.(id, {
            read: row.read as boolean | undefined,
            archived: row.archived as boolean | undefined,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [userId])
}
