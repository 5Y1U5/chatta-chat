"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

type TypingUser = {
  userId: string
  displayName: string
}

const TYPING_TIMEOUT = 3000 // 3秒で自動消去

export function useTypingIndicator(
  channelId: string,
  currentUserId: string,
  currentDisplayName: string
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  // Presence チャンネル購読
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(`typing:${channelId}`, {
      config: { presence: { key: currentUserId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string; displayName: string; typing: boolean }>()
        const users: TypingUser[] = []

        for (const [key, presences] of Object.entries(state)) {
          if (key === currentUserId) continue
          for (const p of presences) {
            if (p.typing) {
              users.push({ userId: p.userId, displayName: p.displayName })
            }
          }
        }

        setTypingUsers(users)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [channelId, currentUserId])

  // 入力中を通知
  const startTyping = useCallback(() => {
    if (!channelRef.current) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      channelRef.current.track({
        userId: currentUserId,
        displayName: currentDisplayName,
        typing: true,
      })
    }

    // タイムアウトをリセット
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      stopTyping()
    }, TYPING_TIMEOUT)
  }, [currentUserId, currentDisplayName])

  // 入力停止を通知
  const stopTyping = useCallback(() => {
    if (!channelRef.current) return
    if (!isTypingRef.current) return

    isTypingRef.current = false
    channelRef.current.track({
      userId: currentUserId,
      displayName: currentDisplayName,
      typing: false,
    })

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [currentUserId, currentDisplayName])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { typingUsers, startTyping, stopTyping }
}
