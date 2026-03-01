import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// ワークスペースのルート → マイチャットにリダイレクト
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  await requireAuth()

  const prisma = getPrisma()
  const generalChannel = await prisma.channel.findFirst({
    where: {
      workspaceId,
      name: "マイチャット",
      type: "public",
    },
    select: { id: true },
  })

  if (generalChannel) {
    redirect(`/${workspaceId}/channel/${generalChannel.id}`)
  }

  // マイチャットが見つからない場合は最初のグループチャットにリダイレクト
  const firstChannel = await prisma.channel.findFirst({
    where: { workspaceId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  if (firstChannel) {
    redirect(`/${workspaceId}/channel/${firstChannel.id}`)
  }

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      グループチャットがありません
    </div>
  )
}
