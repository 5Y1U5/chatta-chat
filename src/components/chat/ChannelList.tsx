"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { NewChannelDialog } from "@/components/chat/NewChannelDialog"
import { NewDmDialog } from "@/components/chat/NewDmDialog"
import { SearchModal } from "@/components/chat/SearchModal"
import { useUnreadCounts } from "@/hooks/useUnreadCounts"

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

// DM の場合は相手の名前を表示
function getChannelDisplayName(
  channel: ChannelItem,
  currentUserId: string
): string {
  if (channel.type === "dm") {
    const other = channel.members.find((m) => m.id !== currentUserId)
    return other?.displayName || "不明なユーザー"
  }
  return channel.name || "名前なし"
}

export function ChannelList({ channels, workspaceId, currentUserId }: Props) {
  const params = useParams()
  const activeChannelId = params.channelId as string | undefined

  // Realtime 未読数管理
  const initialCounts = useMemo(
    () => channels.map((ch) => ({ channelId: ch.id, count: ch.unreadCount })),
    [channels]
  )
  const channelIds = useMemo(() => channels.map((ch) => ch.id), [channels])
  const unreadCounts = useUnreadCounts(initialCounts, activeChannelId, channelIds)

  // 未読数をリアルタイム値で上書き
  const channelsWithLiveCounts = useMemo(
    () => channels.map((ch) => ({ ...ch, unreadCount: unreadCounts.get(ch.id) || 0 })),
    [channels, unreadCounts]
  )

  const [searchOpen, setSearchOpen] = useState(false)

  const publicChannels = channelsWithLiveCounts.filter((ch) => ch.type === "public")
  const groupChannels = channelsWithLiveCounts.filter((ch) => ch.type === "group")
  const dmChannels = channelsWithLiveCounts.filter((ch) => ch.type === "dm")

  return (
    <div className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
      {/* ヘッダー */}
      <div className="flex h-12 items-center justify-between px-4 font-semibold border-b">
        <span>チャンネル</span>
        <button
          title="検索"
          onClick={() => setSearchOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      <SearchModal workspaceId={workspaceId} open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="flex-1 overflow-y-auto py-2">
        {/* パブリックチャンネル */}
        <ChannelSection
          label="チャンネル"
          channels={publicChannels}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          activeChannelId={activeChannelId}
          prefix="#"
          action={<NewChannelDialog workspaceId={workspaceId} />}
        />

        {/* グループチャンネル */}
        {groupChannels.length > 0 && (
          <ChannelSection
            label="グループ"
            channels={groupChannels}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            activeChannelId={activeChannelId}
            prefix="#"
          />
        )}

        {/* DM */}
        <ChannelSection
          label="ダイレクトメッセージ"
          channels={dmChannels}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          activeChannelId={activeChannelId}
          action={<NewDmDialog workspaceId={workspaceId} />}
        />
      </div>
    </div>
  )
}

function ChannelSection({
  label,
  channels,
  workspaceId,
  currentUserId,
  activeChannelId,
  prefix,
  action,
}: {
  label: string
  channels: ChannelItem[]
  workspaceId: string
  currentUserId: string
  activeChannelId?: string
  prefix?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-4 py-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </span>
        {action}
      </div>
      {channels.map((channel) => (
        <Link
          key={channel.id}
          href={`/${workspaceId}/channel/${channel.id}`}
          className={cn(
            "mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted",
            activeChannelId === channel.id && "bg-muted font-medium",
            channel.unreadCount > 0 && activeChannelId !== channel.id && "font-semibold"
          )}
        >
          {prefix && (
            <span className="text-muted-foreground">{prefix}</span>
          )}
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
