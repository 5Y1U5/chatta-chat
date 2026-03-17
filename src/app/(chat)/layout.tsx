import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { WorkspaceSidebar } from "@/components/chat/WorkspaceSidebar"
import { ChannelList } from "@/components/chat/ChannelList"
import { TaskNav } from "@/components/task/TaskNav"
import { MobileHeaderSwitch } from "@/components/chat/MobileHeaderSwitch"
import { MobileBottomNav } from "@/components/chat/MobileBottomNav"
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

  // 各チャンネルのメンバー情報と lastReadAt を整理
  const channelInfos = channelsRaw.map((ch) => {
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
    return { ch, members, lastReadAt }
  })

  // 未読数を一括取得（N+1 回避）
  const unreadCounts = await Promise.all(
    channelInfos.map(({ ch, lastReadAt }) =>
      prisma.message.count({
        where: {
          channelId: ch.id,
          parentId: null,
          deletedAt: null,
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      })
    )
  )

  const channels: ChannelItem[] = channelInfos.map(({ ch, members }, i) => ({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    unreadCount: unreadCounts[i],
    members,
  }))

  // 未読通知数
  const unreadNotificationCount = await prisma.notification.count({
    where: { userId: auth.userId, read: false },
  })

  // ワークスペースメンバー数
  const memberCount = await prisma.workspaceMember.count({
    where: { workspaceId: activeWorkspaceId },
  })

  // プロジェクト一覧（TaskNav / MobileTaskHeader 用）- 完了タスク数も取得
  const projectsRaw = await prisma.project.findMany({
    where: { workspaceId: activeWorkspaceId, archived: false },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  })

  // 各プロジェクトの完了タスク数を並列取得
  const completedCounts = await Promise.all(
    projectsRaw.map((p) =>
      prisma.task.count({ where: { projectId: p.id, status: "done" } })
    )
  )

  const projectsForNav = projectsRaw.map((p, i) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    totalTasks: p._count.tasks,
    completedTasks: completedCounts[i],
  }))

  return (
    <div className="flex h-dvh overflow-hidden">
      <WorkspaceSidebar
        workspace={workspace ? { id: workspace.id, name: workspace.name, iconUrl: workspace.iconUrl } : null}
        workspaceId={activeWorkspaceId}
        unreadNotificationCount={unreadNotificationCount}
        memberCount={memberCount}
      />

      {/* PC第2カラム: チャット時は ChannelList、タスク時は TaskNav */}
      <ChannelList
        channels={channels}
        workspaceId={activeWorkspaceId}
        currentUserId={auth.userId}
      />
      <Suspense>
        <TaskNav
          workspaceId={activeWorkspaceId}
          projects={projectsForNav}
        />
      </Suspense>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <InstallBanner />
        {/* モバイルヘッダー: タスク系ページは MobileTaskHeader、それ以外は MobileSidebar + MobilePageTitle */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <Suspense>
            <MobileHeaderSwitch
              channels={channels}
              workspaceId={activeWorkspaceId}
              currentUserId={auth.userId}
              projects={projectsForNav}
            />
          </Suspense>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0">
          {children}
        </div>
        <MobileBottomNav
          workspaceId={activeWorkspaceId}
          unreadNotificationCount={unreadNotificationCount}
        />
      </main>
    </div>
  )
}
