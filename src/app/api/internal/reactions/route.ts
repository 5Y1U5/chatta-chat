import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// リアクショントグル（追加 or 削除）
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { messageId, emoji } = await request.json()

    if (!messageId || !emoji) {
      return NextResponse.json(
        { error: "messageId と emoji は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // メッセージの存在確認 + ワークスペース境界チェック
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: { select: { workspaceId: true } } },
    })

    if (!message || message.deletedAt || message.channel.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 }
      )
    }

    // 既存リアクションを確認
    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: auth.userId,
          emoji,
        },
      },
    })

    if (existing) {
      // 既にリアクション済み → 削除（トグル）
      await prisma.reaction.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ action: "removed" })
    } else {
      // 未リアクション → 追加
      await prisma.reaction.create({
        data: {
          messageId,
          userId: auth.userId,
          emoji,
        },
      })
      return NextResponse.json({ action: "added" })
    }
  } catch (error) {
    console.error("リアクションエラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// メッセージのリアクション集計取得
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const reactions = await prisma.reaction.findMany({
      where: { messageId },
    })

    // 絵文字ごとに集計
    const emojiMap = new Map<string, { count: number; userReacted: boolean }>()
    for (const r of reactions) {
      const entry = emojiMap.get(r.emoji) || { count: 0, userReacted: false }
      entry.count++
      if (r.userId === auth.userId) {
        entry.userReacted = true
      }
      emojiMap.set(r.emoji, entry)
    }

    const result: { emoji: string; count: number; userReacted: boolean }[] = []
    for (const [emoji, info] of emojiMap) {
      result.push({ emoji, count: info.count, userReacted: info.userReacted })
    }

    return NextResponse.json({ reactions: result })
  } catch (error) {
    console.error("リアクション取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
