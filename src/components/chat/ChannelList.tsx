"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { NewChannelDialog } from "@/components/chat/NewChannelDialog"
import { NewDmDialog } from "@/components/chat/NewDmDialog"

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

  const publicChannels = channels.filter((ch) => ch.type === "public")
  const groupChannels = channels.filter((ch) => ch.type === "group")
  const dmChannels = channels.filter((ch) => ch.type === "dm")

  return (
    <div className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
      {/* ヘッダー */}
      <div className="flex h-12 items-center px-4 font-semibold border-b">
        チャンネル
      </div>

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
            activeChannelId === channel.id && "bg-muted font-medium"
          )}
        >
          {prefix && (
            <span className="text-muted-foreground">{prefix}</span>
          )}
          <span className="truncate">
            {getChannelDisplayName(channel, currentUserId)}
          </span>
        </Link>
      ))}
    </div>
  )
}
