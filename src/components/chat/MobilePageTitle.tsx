"use client"

import { usePathname } from "next/navigation"

export function MobilePageTitle() {
  const pathname = usePathname()

  const getTitle = () => {
    if (pathname.includes("/tasks")) return "マイタスク"
    if (pathname.includes("/inbox")) return "受信トレイ"
    if (pathname.includes("/dashboard")) return "ダッシュボード"
    if (pathname.includes("/projects")) return "プロジェクト"
    if (pathname.includes("/channel/")) return "チャット"
    return "chatta-chat"
  }

  return (
    <span className="font-semibold text-sm truncate flex-1">
      {getTitle()}
    </span>
  )
}
