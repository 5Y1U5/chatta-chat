"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { NewChannelDialog } from "@/components/chat/NewChannelDialog"
import { NewDmDialog } from "@/components/chat/NewDmDialog"
import { ProfileDialog } from "@/components/chat/ProfileDialog"
import { InviteDialog } from "@/components/chat/InviteDialog"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUnreadCounts } from "@/hooks/useUnreadCounts"
import { SearchModal } from "@/components/chat/SearchModal"

type ChannelItem = {
  id: string
  name: string | null
  type: string
  unreadCount: number
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
  const [searchOpen, setSearchOpen] = useState(false)
  const params = useParams()
  const activeChannelId = params.channelId as string | undefined
  const router = useRouter()

  // Realtime 未読数管理
  const initialCounts = useMemo(
    () => channels.map((ch) => ({ channelId: ch.id, count: ch.unreadCount })),
    [channels]
  )
  const channelIds = useMemo(() => channels.map((ch) => ch.id), [channels])
  const unreadCounts = useUnreadCounts(initialCounts, activeChannelId, channelIds)

  const channelsWithLiveCounts = useMemo(
    () => channels.map((ch) => ({ ...ch, unreadCount: unreadCounts.get(ch.id) || 0 })),
    [channels, unreadCounts]
  )

  const publicChannels = channelsWithLiveCounts.filter((ch) => ch.type === "public")
  const groupChannels = channelsWithLiveCounts.filter((ch) => ch.type === "group")
  const dmChannels = channelsWithLiveCounts.filter((ch) => ch.type === "dm")

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const handleClose = () => setOpen(false)

  return (
    <div className="md:hidden">
      {/* ハンバーガーボタン */}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
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
      </button>

      {/* オーバーレイ */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0 duration-200"
            onClick={handleClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r shadow-lg flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex h-12 items-center justify-between px-4 border-b font-semibold">
              <span className="text-sm">チャンネル</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
                  onClick={() => { handleClose(); setSearchOpen(true) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
                  onClick={handleClose}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* チャンネル一覧（ナビはボトムナビに移動済み） */}
              <MobileSection
                label="グループチャット"
                channels={publicChannels}
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                activeChannelId={activeChannelId}
                prefix="#"
                action={<NewChannelDialog workspaceId={workspaceId} />}
                onNavigate={handleClose}
              />

              {groupChannels.length > 0 && (
                <MobileSection
                  label="グループ"
                  channels={groupChannels}
                  workspaceId={workspaceId}
                  currentUserId={currentUserId}
                  activeChannelId={activeChannelId}
                  prefix="#"
                  onNavigate={handleClose}
                />
              )}

              <MobileSection
                label="ダイレクトメッセージ"
                channels={dmChannels}
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                activeChannelId={activeChannelId}
                action={<NewDmDialog workspaceId={workspaceId} />}
                onNavigate={handleClose}
              />
            </div>

            {/* フッター */}
            <div className="flex items-center gap-2 border-t p-3">
              <InviteDialog />
              <ProfileDialog />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground touch-manipulation"
                onClick={handleLogout}
              >
                ログアウト
              </Button>
            </div>
          </div>
        </>
      )}

      <SearchModal workspaceId={workspaceId} open={searchOpen} onClose={() => setSearchOpen(false)} />
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
            "mx-2 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm touch-manipulation active:bg-muted/80 transition-colors",
            activeChannelId === channel.id && "bg-muted font-medium",
            channel.unreadCount > 0 && activeChannelId !== channel.id && "font-semibold"
          )}
        >
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          <span className="flex-1 truncate">
            {getChannelDisplayName(channel, currentUserId)}
          </span>
          {channel.unreadCount > 0 && activeChannelId !== channel.id && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
