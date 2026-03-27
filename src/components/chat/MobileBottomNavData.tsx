// モバイル下部ナビのデータ取得用 Server Component（Suspense で非同期ストリーミング）

import { getPrisma } from "@/lib/prisma"
import { MobileBottomNav } from "@/components/chat/MobileBottomNav"

type Props = {
  workspaceId: string
  userId: string
}

export async function MobileBottomNavData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  const unreadNotificationCount = await prisma.notification.count({
    where: { userId, read: false },
  })

  return (
    <MobileBottomNav
      workspaceId={workspaceId}
      unreadNotificationCount={unreadNotificationCount}
    />
  )
}
