import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// DM チャンネル作成（既存チェック付き）
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { targetUserId } = await request.json()

    if (!targetUserId) {
      return NextResponse.json(
        { error: "対象ユーザーが指定されていません" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 既存の DM チャンネルを検索（自分と相手が両方メンバーの DM）
    const existingDm = await prisma.channel.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        type: "dm",
        AND: [
          { members: { some: { userId: auth.userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
    })

    if (existingDm) {
      return NextResponse.json({ id: existingDm.id, existing: true })
    }

    // 新規 DM チャンネル作成
    const channel = await prisma.channel.create({
      data: {
        workspaceId: auth.workspaceId,
        name: null,
        type: "dm",
      },
    })

    // 自分と相手をメンバーに追加
    await prisma.channelMember.createMany({
      data: [
        { channelId: channel.id, userId: auth.userId },
        { channelId: channel.id, userId: targetUserId },
      ],
    })

    return NextResponse.json({ id: channel.id, existing: false })
  } catch (error) {
    console.error("DM作成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
