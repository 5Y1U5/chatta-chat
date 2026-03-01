"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { NewChannelDialog } from "@/components/chat/NewChannelDialog"
import { NewDmDialog } from "@/components/chat/NewDmDialog"
import { ProfileDialog } from "@/components/chat/ProfileDialog"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"

type ChannelItem = {
  id: string
  name: string | null
  type: string
  members: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }[]
}

type Props = {
  channels: ChannelItem[]
  workspaceId: string
  currentUserId: string
}

function getChannelDisplayName(channel: ChannelItem, currentUserId: string): string {
  if (channel.type === "dm") {
    const other = channel.members.find((m) => m.id !== currentUserId)
    return other?.displayName || "不明なユーザー"
  }
  return channel.name || "名前なし"
}

export function MobileSidebar({ channels, workspaceId, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const params = useParams()
  const activeChannelId = params.channelId as string | undefined
  const router = useRouter()

  const publicChannels = channels.filter((ch) => ch.type === "public")
  const groupChannels = channels.filter((ch) => ch.type === "group")
  const dmChannels = channels.filter((ch) => ch.type === "dm")

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="md:hidden">
      {/* ハンバーガーボタン（チャンネルヘッダーに埋め込む） */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(!open)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </Button>

      {/* オーバーレイ */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r shadow-lg flex flex-col">
            <div className="flex h-12 items-center justify-between px-4 border-b font-semibold">
              チャンネル
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* パブリックチャンネル */}
              <MobileSection
                label="チャンネル"
                channels={publicChannels}
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                activeChannelId={activeChannelId}
                prefix="#"
                action={<NewChannelDialog workspaceId={workspaceId} />}
                onNavigate={() => setOpen(false)}
              />

              {groupChannels.length > 0 && (
                <MobileSection
                  label="グループ"
                  channels={groupChannels}
                  workspaceId={workspaceId}
                  currentUserId={currentUserId}
                  activeChannelId={activeChannelId}
                  prefix="#"
                  onNavigate={() => setOpen(false)}
                />
              )}

              <MobileSection
                label="ダイレクトメッセージ"
                channels={dmChannels}
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                activeChannelId={activeChannelId}
                action={<NewDmDialog workspaceId={workspaceId} />}
                onNavigate={() => setOpen(false)}
              />
            </div>

            {/* フッター */}
            <div className="flex items-center gap-2 border-t p-3">
              <ProfileDialog />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleLogout}
              >
                ログアウト
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MobileSection({
  label,
  channels,
  workspaceId,
  currentUserId,
  activeChannelId,
  prefix,
  action,
  onNavigate,
}: {
  label: string
  channels: ChannelItem[]
  workspaceId: string
  currentUserId: string
  activeChannelId?: string
  prefix?: string
  action?: React.ReactNode
  onNavigate: () => void
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-4 py-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
        {action}
      </div>
      {channels.map((channel) => (
        <Link
          key={channel.id}
          href={`/${workspaceId}/channel/${channel.id}`}
          onClick={onNavigate}
          className={cn(
            "mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
            activeChannelId === channel.id && "bg-muted font-medium"
          )}
        >
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          <span className="truncate">
            {getChannelDisplayName(channel, currentUserId)}
          </span>
        </Link>
      ))}
    </div>
  )
}
