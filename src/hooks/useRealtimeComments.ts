"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TaskCommentInfo } from "@/types/chat"

type Options = {
  taskId: string | null
  onNewComment: (comment: TaskCommentInfo) => void
}

/**
 * TaskComment テーブルの INSERT をリアルタイム購読し、
 * 新コメントが届いたらコールバックで通知する
 */
export function useRealtimeComments({ taskId, onNewComment }: Options) {
  const callbackRef = useRef(onNewComment)
  callbackRef.current = onNewComment

  useEffect(() => {
    if (!taskId) return

    const supabase = createClient()

    const subscription = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "TaskComment",
          filter: `taskId=eq.${taskId}`,
        },
        (payload) => {
          const row = payload.new
          // 楽観的更新で既に追加済みの可能性があるため、IDで判定はコールバック側に任せる
          const comment: TaskCommentInfo = {
            id: row.id as string,
            taskId: row.taskId as string,
            content: row.content as string,
            fileUrl: (row.fileUrl as string) || null,
            fileName: (row.fileName as string) || null,
            fileType: (row.fileType as string) || null,
            createdAt: row.created_at as string,
            user: {
              id: row.userId as string,
              displayName: null,
              avatarUrl: null,
            },
          }
          callbackRef.current(comment)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [taskId])
}
