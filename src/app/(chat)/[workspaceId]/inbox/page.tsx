import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { InboxView } from "@/components/task/InboxView"

export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const prisma = getPrisma()

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.userId },
    include: {
      actor: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <InboxView
      notifications={JSON.parse(JSON.stringify(notifications))}
      workspaceId={workspaceId}
    />
  )
}
