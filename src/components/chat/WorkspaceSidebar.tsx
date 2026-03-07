"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ProfileDialog } from "@/components/chat/ProfileDialog"
import { InviteDialog } from "@/components/chat/InviteDialog"
import { cn } from "@/lib/utils"

type Props = {
  workspace: {
    id: string
    name: string
    iconUrl: string | null
  } | null
  workspaceId: string
  unreadNotificationCount?: number
}

export function WorkspaceSidebar({ workspace, workspaceId, unreadNotificationCount = 0 }: Props) {
  const [expanded, setExpanded] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const isDashboardActive = pathname.includes("/dashboard")
  const isChatActive = pathname.includes("/channel/") && !isDashboardActive
  const isTasksActive = pathname.includes("/tasks")
  const isInboxActive = pathname.includes("/inbox")

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const navItems = [
    {
      label: "チャット",
      active: isChatActive,
      onClick: () => router.push(`/${workspaceId}`),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: "マイタスク",
      active: isTasksActive,
      onClick: () => router.push(`/${workspaceId}/tasks`),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      label: "受信トレイ",
      active: isInboxActive,
      onClick: () => router.push(`/${workspaceId}/inbox`),
      badge: unreadNotificationCount,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      ),
    },
    {
      label: "ダッシュボード",
      active: isDashboardActive,
      onClick: () => router.push(`/${workspaceId}/dashboard`),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className={cn(
        "hidden flex-col gap-2 bg-muted/50 py-3 border-r md:flex transition-all duration-200",
        expanded ? "w-44 items-stretch px-2" : "w-14 items-center"
      )}
    >
      {/* ワークスペースアイコン + トグルボタン */}
      <div className={cn("flex items-center gap-2", expanded ? "px-1" : "flex-col")}>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {workspace?.name?.charAt(0)?.toUpperCase() || "W"}
          </AvatarFallback>
        </Avatar>
        {expanded && (
          <span className="text-sm font-semibold truncate">{workspace?.name || "Workspace"}</span>
        )}
        <div className={expanded ? "ml-auto" : ""}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {expanded ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="M14 9l-3 3 3 3" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="M14 9l3 3-3 3" />
                </>
              )}
            </svg>
          </Button>
        </div>
      </div>

      <Separator className={expanded ? "" : "w-8 mx-auto"} />

      {/* ナビゲーション */}
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          className={cn(
            "relative text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95",
            expanded
              ? "h-9 justify-start gap-2 px-2 text-sm"
              : "h-9 w-9 hover:scale-110",
            item.active && "bg-muted text-foreground"
          )}
          size={expanded ? "sm" : "icon"}
          onClick={item.onClick}
          title={expanded ? undefined : item.label}
        >
          <span className="shrink-0">{item.icon}</span>
          {expanded && <span className="truncate">{item.label}</span>}
          {item.badge && item.badge > 0 && (
            <span className={cn(
              "flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground",
              expanded ? "ml-auto" : "absolute -top-0.5 -right-0.5"
            )}>
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </Button>
      ))}

      <Separator className={expanded ? "" : "w-8 mx-auto"} />

      {/* メンバー招待 */}
      <InviteDialog />

      {/* スペーサー */}
      <div className="flex-1" />

      {/* プロフィール */}
      <ProfileDialog />

      {/* ログアウト */}
      <Button
        variant="ghost"
        className={cn(
          "text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95",
          expanded
            ? "h-9 justify-start gap-2 px-2 text-sm"
            : "h-9 w-9 hover:scale-110"
        )}
        size={expanded ? "sm" : "icon"}
        onClick={handleLogout}
        title={expanded ? undefined : "ログアウト"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {expanded && <span>ログアウト</span>}
      </Button>
    </div>
  )
}
