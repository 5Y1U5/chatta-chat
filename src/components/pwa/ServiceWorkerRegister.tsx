"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // SW から更新通知を受けたらページをリロード
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATED") {
        // 次のアイドル時にリロード（ユーザー操作を妨げない）
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => window.location.reload())
        } else {
          setTimeout(() => window.location.reload(), 100)
        }
      }
    })

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // 起動時に即座に更新チェック
        registration.update().catch(() => {})

        // 定期的に更新チェック（5分ごと）
        const interval = setInterval(() => {
          registration.update().catch(() => {})
        }, 5 * 60 * 1000)

        // 新しいSWがインストール待ちの場合、即座にアクティブ化を要求
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              // 新SWがアクティブ化 → リロードで最新を反映
              window.location.reload()
            }
          })
        })

        return () => clearInterval(interval)
      })
      .catch((error) => {
        console.error("Service Worker 登録失敗:", error)
      })
  }, [])

  return null
}
