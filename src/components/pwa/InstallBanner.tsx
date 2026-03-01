"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const STORAGE_KEY = "pwa-install-banner-dismissed"

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // モバイルデバイス（スマホ・タブレット）のみ表示、PCでは非表示
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice) return

    // standalone モードなら表示しない（既にホーム画面から起動中）
    if (window.matchMedia("(display-mode: standalone)").matches) return
    if ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone === true) return

    // 一度閉じた場合は表示しない
    if (localStorage.getItem(STORAGE_KEY)) return

    // iOS 判定
    const ua = navigator.userAgent
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    setIsIOS(isiOS)

    if (isiOS) {
      setShow(true)
      return
    }

    // Android/Chrome: beforeinstallprompt イベントを待つ
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShow(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, "true")
  }, [])

  if (!show) return null

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-primary px-3 py-2 text-primary-foreground animate-pulse">
      <div className="flex-1 text-xs font-medium">
        {isIOS ? (
          <>
            <span className="font-bold">ホーム画面に追加</span>
            してアプリとして使えます
            <span className="block text-[10px] opacity-80 mt-0.5">
              共有ボタン → 「ホーム画面に追加」をタップ
            </span>
          </>
        ) : (
          <>
            <span className="font-bold">ホーム画面に追加</span>
            してアプリとして使えます
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {deferredPrompt && (
          <Button variant="secondary" size="xs" onClick={handleInstall}>
            追加する
          </Button>
        )}
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
          onClick={handleDismiss}
          aria-label="閉じる"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
