import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { WorkspaceSidebar } from "@/components/chat/WorkspaceSidebar"
import { ChannelList } from "@/components/chat/ChannelList"
import { MobileSidebar } from "@/components/chat/MobileSidebar"
import { InstallBanner } from "@/components/pwa/InstallBanner"

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

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId?: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const activeWorkspaceId = workspaceId || auth.workspaceId

  const prisma = getPrisma()

  // ワークスペース情報
  const workspace = await prisma.workspace.findUnique({
    where: { id: activeWorkspaceId },
  })

  // チャンネル一覧（ユーザーが参加しているもの）
  const channelsRaw = await prisma.channel.findMany({
    where: {
      workspaceId: activeWorkspaceId,
      members: {
        some: { userId: auth.userId },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // 各チャンネルの未読数を計算
  const channels: ChannelItem[] = []
  for (const ch of channelsRaw) {
    const members: ChannelItem["members"] = []
    let lastReadAt: Date | null = null

    for (const m of ch.members) {
      members.push({
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })
      if (m.userId === auth.userId) {
        lastReadAt = m.lastReadAt
      }
    }

    // lastReadAt 以降のルートメッセージ数 = 未読数
    const unreadCount = await prisma.message.count({
      where: {
        channelId: ch.id,
        parentId: null,
        deletedAt: null,
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    })

    channels.push({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      unreadCount,
      members,
    })
  }

  // 未読通知数
  const unreadNotificationCount = await prisma.notification.count({
    where: { userId: auth.userId, read: false },
  })

  // プロジェクト一覧（サイドバー用）
  const projectsRaw = await prisma.project.findMany({
    where: { workspaceId: activeWorkspaceId, archived: false },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="flex h-dvh overflow-hidden">
      <WorkspaceSidebar
        workspace={workspace ? { id: workspace.id, name: workspace.name, iconUrl: workspace.iconUrl } : null}
        workspaceId={activeWorkspaceId}
        unreadNotificationCount={unreadNotificationCount}
      />

      <ChannelList
        channels={channels}
        workspaceId={activeWorkspaceId}
        currentUserId={auth.userId}
        projects={JSON.parse(JSON.stringify(projectsRaw))}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <InstallBanner />
        {/* モバイルヘッダー */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <MobileSidebar
            channels={channels}
            workspaceId={activeWorkspaceId}
            currentUserId={auth.userId}
          />
          <span className="font-semibold text-sm truncate">chatta-chat</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
