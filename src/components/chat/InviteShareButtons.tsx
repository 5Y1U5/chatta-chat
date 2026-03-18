"use client"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"

const INVITE_MESSAGE_TEMPLATE = (url: string) =>
  `Chatta（チャットツール）に招待されました！\n以下のリンクからアカウントを作成して参加してください。\n\n${url}`

type Props = {
  url: string
}

export function InviteShareButtons({ url }: Props) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // フォールバック
    }
  }

  function handleLine() {
    const text = encodeURIComponent(INVITE_MESSAGE_TEMPLATE(url))
    window.open(`https://line.me/R/share?text=${text}`, "_blank")
  }

  function handleEmail() {
    const subject = encodeURIComponent("Chattaへの招待")
    const body = encodeURIComponent(INVITE_MESSAGE_TEMPLATE(url))
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: "Chattaへの招待",
        text: INVITE_MESSAGE_TEMPLATE(url),
        url,
      })
    } catch {
      // ユーザーがキャンセルした場合
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* コピー */}
        <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          {copied ? "コピー済み" : "コピー"}
        </Button>

        {/* LINE */}
        <Button onClick={handleLine} variant="outline" size="sm" className="gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          LINE
        </Button>

        {/* メール */}
        <Button onClick={handleEmail} variant="outline" size="sm" className="gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          メール
        </Button>

        {/* QRコード */}
        <Button onClick={() => setShowQR(!showQR)} variant="outline" size="sm" className="gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          </svg>
          QR
        </Button>

        {/* Web Share API */}
        {canShare && (
          <Button onClick={handleShare} variant="outline" size="sm" className="gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
              <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
            </svg>
            その他
          </Button>
        )}
      </div>

      {/* QRコード表示 */}
      {showQR && (
        <div className="flex justify-center rounded-lg border bg-white p-4">
          <QRCodeSVG value={url} size={160} />
        </div>
      )}
    </div>
  )
}
