// サイドバーのデータ取得用 Server Component（Suspense で非同期ストリーミング）

import { getPrisma } from "@/lib/prisma"
import { WorkspaceSidebar } from "@/components/chat/WorkspaceSidebar"

type Props = {
  workspaceId: string
  userId: string
}

export async function SidebarData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  const [workspace, unreadNotificationCount, memberCount] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
    prisma.workspaceMember.count({
      where: { workspaceId },
    }),
  ])

  return (
    <WorkspaceSidebar
      workspace={workspace ? { id: workspace.id, name: workspace.name, iconUrl: workspace.iconUrl } : null}
      workspaceId={workspaceId}
      unreadNotificationCount={unreadNotificationCount}
      memberCount={memberCount}
    />
  )
}
