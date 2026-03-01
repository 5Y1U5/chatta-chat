import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// メッセージ検索（ワークスペース内の所属チャンネルを横断）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    if (!q || q.length === 0) {
      return NextResponse.json({ results: [] })
    }

    const prisma = getPrisma()

    // ユーザーが所属するチャンネルIDを取得
    const memberships = await prisma.channelMember.findMany({
      where: { userId: auth.userId },
      select: { channelId: true },
    })
    const channelIds = memberships.map((m) => m.channelId)

    if (channelIds.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // ILIKE で部分一致検索（最大30件）
    const messages = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        deletedAt: null,
        content: { contains: q, mode: "insensitive" },
      },
      include: {
        user: true,
        channel: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    })

    const results = messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      parentId: m.parentId,
      channelId: m.channelId,
      channelName: m.channel.name,
      channelType: m.channel.type,
      user: {
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      },
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("メッセージ検索エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
