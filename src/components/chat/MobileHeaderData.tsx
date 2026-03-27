// モバイルヘッダーのデータ取得用 Server Component（Suspense で非同期ストリーミング）

import { getPrisma } from "@/lib/prisma"
import { MobileHeaderSwitch } from "@/components/chat/MobileHeaderSwitch"

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
  workspaceId: string
  userId: string
}

export async function MobileHeaderData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  // チャンネル一覧とプロジェクト一覧を並列取得
  const [channelsRaw, projectsRaw] = await Promise.all([
    prisma.channel.findMany({
      where: {
        workspaceId,
        members: { some: { userId } },
      },
      include: {
        members: {
          select: {
            userId: true,
            lastReadAt: true,
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: {
        workspaceId,
        archived: false,
        members: { some: { userId } },
      },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: "done" },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ])

  // チャンネル未読数計算（ChannelListData と同じロジック）
  const channelInfos = channelsRaw.map((ch) => {
    const members: ChannelItem["members"] = []
    let lastReadAt: Date | null = null
    for (const m of ch.members) {
      members.push({
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })
      if (m.userId === userId) {
        lastReadAt = m.lastReadAt
      }
    }
    return { ch, members, lastReadAt }
  })

  const channelIds = channelInfos.map(({ ch }) => ch.id)
  let unreadMap = new Map<string, number>()

  if (channelIds.length > 0) {
    const lastReadMap = new Map(
      channelInfos.map(({ ch, lastReadAt }) => [ch.id, lastReadAt])
    )
    const hasNullLastRead = channelInfos.some(({ lastReadAt }) => !lastReadAt)
    const oldestLastRead = hasNullLastRead
      ? null
      : channelInfos.reduce<Date | null>((oldest: Date | null, { lastReadAt }: { lastReadAt: Date | null }) => {
          if (!oldest || (lastReadAt && lastReadAt < oldest)) return lastReadAt
          return oldest
        }, null)

    const unreadMessages = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        parentId: null,
        deletedAt: null,
        ...(oldestLastRead ? { createdAt: { gt: oldestLastRead } } : {}),
      },
      select: { channelId: true, createdAt: true },
    })

    for (const msg of unreadMessages) {
      const lastRead = lastReadMap.get(msg.channelId)
      if (!lastRead || msg.createdAt > lastRead) {
        unreadMap.set(msg.channelId, (unreadMap.get(msg.channelId) || 0) + 1)
      }
    }
  }

  const channels: ChannelItem[] = channelInfos.map(({ ch, members }) => ({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    unreadCount: unreadMap.get(ch.id) || 0,
    members,
  }))

  const projects = projectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    totalTasks: p._count.tasks,
    completedTasks: p.tasks.length,
  }))

  return (
    <MobileHeaderSwitch
      channels={channels}
      workspaceId={workspaceId}
      currentUserId={userId}
      projects={projects}
    />
  )
}
