import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { WorkspaceSidebar } from "@/components/chat/WorkspaceSidebar"
import { ChannelList } from "@/components/chat/ChannelList"
import { MobileSidebar } from "@/components/chat/MobileSidebar"

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

  const channels: ChannelItem[] = []
  for (const ch of channelsRaw) {
    const members: ChannelItem["members"] = []
    for (const m of ch.members) {
      members.push({
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })
    }
    channels.push({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      members,
    })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <WorkspaceSidebar
        workspace={workspace ? { id: workspace.id, name: workspace.name, iconUrl: workspace.iconUrl } : null}
        workspaceId={activeWorkspaceId}
      />

      <ChannelList
        channels={channels}
        workspaceId={activeWorkspaceId}
        currentUserId={auth.userId}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* モバイルヘッダー */}
        <div className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <MobileSidebar
            channels={channels}
            workspaceId={activeWorkspaceId}
            currentUserId={auth.userId}
          />
          <span className="font-semibold text-sm truncate">chatta-chat</span>
        </div>
        {children}
      </main>
    </div>
  )
}
