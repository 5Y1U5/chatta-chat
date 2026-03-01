import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { MessageView } from "@/components/chat/MessageView"
import type { MessageWithUser, ChannelMemberInfo, ReactionInfo } from "@/types/chat"

function aggregateReactions(
  reactions: { emoji: string; userId: string }[],
  currentUserId: string
): ReactionInfo[] {
  const emojiMap = new Map<string, { count: number; userReacted: boolean }>()
  for (const r of reactions) {
    const entry = emojiMap.get(r.emoji) || { count: 0, userReacted: false }
    entry.count++
    if (r.userId === currentUserId) entry.userReacted = true
    emojiMap.set(r.emoji, entry)
  }
  const result: ReactionInfo[] = []
  for (const [emoji, info] of emojiMap) {
    result.push({ emoji, count: info.count, userReacted: info.userReacted })
  }
  return result
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ workspaceId: string; channelId: string }>
}) {
  const { workspaceId, channelId } = await params
  const auth = await requireAuth()

  const prisma = getPrisma()

  // チャンネル情報取得
  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      workspaceId,
    },
  })

  if (!channel) {
    notFound()
  }

  // ルートメッセージのみ取得（parentId: null）、削除済みを除外
  const messagesRaw = await prisma.message.findMany({
    where: {
      channelId,
      parentId: null,
      deletedAt: null,
    },
    include: {
      user: true,
      reactions: true,
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  const initialMessages: MessageWithUser[] = []
  for (const m of messagesRaw) {
    initialMessages.push({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      userId: m.userId,
      parentId: m.parentId,
      aiGenerated: m.aiGenerated,
      deletedAt: null,
      replyCount: m._count.replies,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      fileType: m.fileType,
      reactions: aggregateReactions(m.reactions, auth.userId),
      user: {
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      },
    })
  }

  // チャンネルメンバー情報（DM 表示名に使用）
  const membersRaw = await prisma.channelMember.findMany({
    where: { channelId },
    include: { user: true },
  })

  const members: ChannelMemberInfo[] = []
  for (const m of membersRaw) {
    members.push({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
    })
  }

  return (
    <MessageView
      channel={channel}
      initialMessages={initialMessages}
      members={members}
      currentUserId={auth.userId}
      workspaceId={workspaceId}
    />
  )
}
