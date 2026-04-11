"use client"

import { useState, useEffect, useCallback } from "react"

// カスタムイベント名
const BADGE_EVENT = "notification-badge-update"

type BadgeDetail = { delta: number } | { count: number }

/**
 * 通知バッジのリアルタイム更新フック
 * サーバーから取得した初期値をベースに、カスタムイベントで増減を反映
 */
export function useNotificationBadge(initialCount: number) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BadgeDetail>).detail
      if ("count" in detail) {
        setCount(detail.count)
      } else {
        setCount((prev) => Math.max(0, prev + detail.delta))
      }
    }
    window.addEventListener(BADGE_EVENT, handler)
    return () => window.removeEventListener(BADGE_EVENT, handler)
  }, [])

  // 初期値がサーバー再レンダリングで変わった場合に同期
  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  return count
}

/** バッジを1つ減らす（既読・アーカイブ時） */
export function decrementBadge() {
  window.dispatchEvent(new CustomEvent<BadgeDetail>(BADGE_EVENT, { detail: { delta: -1 } }))
}

/** バッジを1つ増やす（新通知受信時） */
export function incrementBadge() {
  window.dispatchEvent(new CustomEvent<BadgeDetail>(BADGE_EVENT, { detail: { delta: 1 } }))
}

/** バッジを0にする（全て既読時） */
export function clearBadge() {
  window.dispatchEvent(new CustomEvent<BadgeDetail>(BADGE_EVENT, { detail: { count: 0 } }))
}
