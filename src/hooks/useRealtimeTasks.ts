"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

type TaskChange = {
  event: "INSERT" | "UPDATE" | "DELETE"
  id: string
  row: Record<string, unknown>
}

type Options = {
  workspaceId: string
  onTaskChange: (change: TaskChange) => void
}

/**
 * Task テーブルの INSERT/UPDATE をリアルタイム購読し、
 * タスクの作成・更新・完了を検知する
 */
export function useRealtimeTasks({ workspaceId, onTaskChange }: Options) {
  const callbackRef = useRef(onTaskChange)
  callbackRef.current = onTaskChange

  useEffect(() => {
    if (!workspaceId) return

    const supabase = createClient()

    // RLS 有効テーブルでは postgres_changes に明示的フィルタが必要。
    // フィルタ無しだと Realtime から配信されない（Supabase 仕様）。
    // 念のため JS 側のフィルタも残しておく（保険）。
    const subscription = supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Task",
          filter: `workspaceId=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.new.workspaceId !== workspaceId) return
          callbackRef.current({
            event: "INSERT",
            id: payload.new.id as string,
            row: payload.new,
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Task",
          filter: `workspaceId=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.new.workspaceId !== workspaceId) return
          callbackRef.current({
            event: "UPDATE",
            id: payload.new.id as string,
            row: payload.new,
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "Task",
          filter: `workspaceId=eq.${workspaceId}`,
        },
        (payload) => {
          // DELETE イベントは old レコードのみ含む
          // REPLICA IDENTITY FULL のため old に全カラム入っている
          const old = payload.old as Record<string, unknown>
          if (old.workspaceId !== workspaceId) return
          callbackRef.current({
            event: "DELETE",
            id: old.id as string,
            row: old,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [workspaceId])
}
