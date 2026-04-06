"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TaskCommentInfo } from "@/types/chat"

type MemberLookup = { id: string; displayName: string | null; avatarUrl: string | null }

type Options = {
  taskId: string | null
  onNewComment: (comment: TaskCommentInfo) => void
  /** ユーザー情報補完用のメンバーリスト */
  members?: MemberLookup[]
}

/**
 * TaskComment テーブルの INSERT をリアルタイム購読し、
 * 新コメントが届いたらコールバックで通知する
 */
export function useRealtimeComments({ taskId, onNewComment, members }: Options) {
  const callbackRef = useRef(onNewComment)
  callbackRef.current = onNewComment
  const membersRef = useRef(members)
  membersRef.current = members

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
          const userId = row.userId as string
          // メンバーリストからユーザー情報を補完
          const member = membersRef.current?.find((m) => m.id === userId)
          const comment: TaskCommentInfo = {
            id: row.id as string,
            taskId: row.taskId as string,
            content: row.content as string,
            fileUrl: (row.fileUrl as string) || null,
            fileName: (row.fileName as string) || null,
            fileType: (row.fileType as string) || null,
            createdAt: row.created_at as string,
            user: {
              id: userId,
              displayName: member?.displayName || null,
              avatarUrl: member?.avatarUrl || null,
            },
          }
          callbackRef.current(comment)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "GuestComment",
          filter: `taskId=eq.${taskId}`,
        },
        (payload) => {
          const row = payload.new
          const comment: TaskCommentInfo = {
            id: row.id as string,
            taskId: row.taskId as string,
            content: row.content as string,
            fileUrl: null,
            fileName: null,
            fileType: null,
            createdAt: row.created_at as string,
            user: {
              id: `guest-${row.id}`,
              displayName: `${row.guestName}（ゲスト）`,
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
