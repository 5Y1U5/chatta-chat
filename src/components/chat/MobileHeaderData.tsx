// モバイルヘッダーのデータ取得用 Server Component（Suspense で非同期ストリーミング）
// 未読数計算を省略して高速化（未読数はクライアント側の useUnreadCounts で管理）

import { getPrisma } from "@/lib/prisma"
import { MobileHeaderSwitch } from "@/components/chat/MobileHeaderSwitch"

type Props = {
  workspaceId: string
  userId: string
}

export async function MobileHeaderData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  // チャンネル一覧とプロジェクト一覧を並列取得（未読数計算は省略して高速化）
  const [channelsRaw, projectsRaw] = await Promise.all([
    prisma.channel.findMany({
      where: {
        workspaceId,
        members: { some: { userId } },
      },
      include: {
        members: {
          select: {
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
        tasks: {
          select: { id: true, status: true, parentTaskId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const channels = channelsRaw.map((ch) => ({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    unreadCount: 0, // クライアント側の useUnreadCounts で管理
    members: ch.members.map((m) => m.user),
  }))

  const projects = projectsRaw.map((p) => {
    const parentTasks = p.tasks.filter((t) => !t.parentTaskId)
    const subTasks = p.tasks.filter((t) => t.parentTaskId)
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      totalParentTasks: parentTasks.length,
      completedParentTasks: parentTasks.filter((t) => t.status === "done").length,
      totalSubTasks: subTasks.length,
      completedSubTasks: subTasks.filter((t) => t.status === "done").length,
    }
  })

  return (
    <MobileHeaderSwitch
      channels={channels}
      workspaceId={workspaceId}
      currentUserId={userId}
      projects={projects}
    />
  )
}
