"use client"

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

  return (
    <div className="hidden w-14 flex-col items-center gap-2 bg-muted/50 py-3 border-r md:flex">
      {/* ワークスペースアイコン */}
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
          {workspace?.name?.charAt(0)?.toUpperCase() || "W"}
        </AvatarFallback>
      </Avatar>

      <Separator className="w-8" />

      {/* チャット */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:scale-110 active:scale-95",
          isChatActive && "bg-muted text-foreground"
        )}
        onClick={() => router.push(`/${workspaceId}`)}
        title="チャット"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Button>

      {/* マイタスク */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:scale-110 active:scale-95",
          isTasksActive && "bg-muted text-foreground"
        )}
        onClick={() => router.push(`/${workspaceId}/tasks`)}
        title="マイタスク"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </Button>

      {/* 受信トレイ */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-9 w-9 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:scale-110 active:scale-95",
          isInboxActive && "bg-muted text-foreground"
        )}
        onClick={() => router.push(`/${workspaceId}/inbox`)}
        title="受信トレイ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </Button>

      {/* ダッシュボード */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:scale-110 active:scale-95",
          isDashboardActive && "bg-muted text-foreground"
        )}
        onClick={() => router.push(`/${workspaceId}/dashboard`)}
        title="ダッシュボード"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      </Button>

      <Separator className="w-8" />

      {/* メンバー招待 */}
      <InviteDialog />

      {/* スペーサー */}
      <div className="flex-1" />

      {/* プロフィール */}
      <ProfileDialog />

      {/* ログアウト */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:scale-110 active:scale-95"
        onClick={handleLogout}
        title="ログアウト"
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
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </Button>
    </div>
  )
}
