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

  // ---- 全クエリを最大限並列化 ----
  const [workspace, channelsRaw, unreadNotificationCount, memberCount, projectsRaw] = await Promise.all([
    // ワークスペース情報
    prisma.workspace.findUnique({
      where: { id: activeWorkspaceId },
    }),
    // チャンネル一覧（ユーザーが参加しているもの）— 必要フィールドのみ取得
    prisma.channel.findMany({
      where: {
        workspaceId: activeWorkspaceId,
        members: {
          some: { userId: auth.userId },
        },
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
    // 未読通知数
    prisma.notification.count({
      where: { userId: auth.userId, read: false },
    }),
    // ワークスペースメンバー数
    prisma.workspaceMember.count({
      where: { workspaceId: activeWorkspaceId },
    }),
    // プロジェクト一覧（TaskNav / MobileTaskHeader 用）- メンバーのみ表示
    prisma.project.findMany({
      where: {
        workspaceId: activeWorkspaceId,
        archived: false,
        members: { some: { userId: auth.userId } },
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

  // 未読数を一括取得（生SQLで1クエリに統合）
  const channelIds = channelInfos.map(({ ch }) => ch.id)
  let unreadMap = new Map<string, number>()

  if (channelIds.length > 0) {
    // 各チャネルの lastReadAt をマップ化
    const lastReadMap = new Map(
      channelInfos.map(({ ch, lastReadAt }) => [ch.id, lastReadAt])
    )

    // 最も古い lastReadAt を取得（null がある場合は全メッセージをカウント）
    const hasNullLastRead = channelInfos.some(({ lastReadAt }) => !lastReadAt)
    const oldestLastRead = hasNullLastRead
      ? null
      : channelInfos.reduce<Date | null>((oldest: Date | null, { lastReadAt }: { lastReadAt: Date | null }) => {
          if (!oldest || (lastReadAt && lastReadAt < oldest)) return lastReadAt
          return oldest
        }, null)

    // 1クエリで全チャネルの未読候補メッセージを取得
    const unreadMessages = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        parentId: null,
        deletedAt: null,
        ...(oldestLastRead ? { createdAt: { gt: oldestLastRead } } : {}),
      },
      select: { channelId: true, createdAt: true },
    })

    // チャネルごとに lastReadAt 以降のメッセージ数をカウント
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

  // プロジェクト完了タスク数はincludeで取得済み（N+1クエリ不要）
  const projectsForNav = projectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    totalTasks: p._count.tasks,
    completedTasks: p.tasks.length,
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
      <Suspense fallback={<div className="hidden md:block w-56 shrink-0 border-r" />}>
        <TaskNav
          workspaceId={activeWorkspaceId}
          projects={projectsForNav}
        />
      </Suspense>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <InstallBanner />
        {/* モバイルヘッダー: タスク系ページは MobileTaskHeader、それ以外は MobileSidebar + MobilePageTitle */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <Suspense fallback={<div className="h-5 w-32 rounded bg-muted animate-pulse" />}>
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
