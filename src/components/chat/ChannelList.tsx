"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { NewChannelDialog } from "@/components/chat/NewChannelDialog"
import { NewDmDialog } from "@/components/chat/NewDmDialog"
import { SearchModal } from "@/components/chat/SearchModal"
import { ChannelSettingsMenu } from "@/components/chat/ChannelSettingsMenu"
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

type ProjectItem = {
  id: string
  name: string
  color: string | null
  _count: { tasks: number }
}

type Props = {
  channels: ChannelItem[]
  workspaceId: string
  currentUserId: string
  projects?: ProjectItem[]
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

export function ChannelList({ channels, workspaceId, currentUserId, projects = [] }: Props) {
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
        <span>グループチャット</span>
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
          label="グループチャット"
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

        {/* プロジェクト */}
        {projects.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                プロジェクト
              </span>
              <Link
                href={`/${workspaceId}/projects`}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="プロジェクト管理"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </Link>
            </div>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/${workspaceId}/tasks?projectId=${project.id}`}
                className="mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: project.color || "#6B7280" }}
                />
                <span className="flex-1 truncate">{project.name}</span>
                <span className="text-[10px] text-muted-foreground">{project._count.tasks}</span>
              </Link>
            ))}
          </div>
        )}
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
        <div
          key={channel.id}
          className="group/item mx-2 flex items-center rounded-md hover:bg-muted"
        >
          <Link
            href={`/${workspaceId}/channel/${channel.id}`}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-sm min-w-0",
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
          <div className="hidden shrink-0 group-hover/item:block">
            <ChannelSettingsMenu
              channel={{ id: channel.id, name: channel.name, type: channel.type }}
              workspaceId={workspaceId}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
