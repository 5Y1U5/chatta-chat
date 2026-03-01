"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ProfileDialog } from "@/components/chat/ProfileDialog"
import { InviteDialog } from "@/components/chat/InviteDialog"

type Props = {
  workspace: {
    id: string
    name: string
    iconUrl: string | null
  } | null
  workspaceId: string
}

export function WorkspaceSidebar({ workspace }: Props) {
  const router = useRouter()

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
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
