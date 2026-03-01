import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// 過去メッセージ取得（カーソルベースページネーション）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")
    const cursor = searchParams.get("cursor") // 最古メッセージのID
    const limit = 50

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // チャンネルメンバーか確認
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: auth.userId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "このチャンネルのメンバーではありません" },
        { status: 403 }
      )
    }

    // カーソルの createdAt を取得
    let cursorDate: Date | undefined
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })
      if (cursorMessage) {
        cursorDate = cursorMessage.createdAt
      }
    }

    const messagesRaw = await prisma.message.findMany({
      where: {
        channelId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    // 古い順に並び替え
    messagesRaw.reverse()

    const messages: { id: string; content: string; createdAt: string; userId: string; user: { id: string; displayName: string | null; avatarUrl: string | null } }[] = []
    for (const m of messagesRaw) {
      messages.push({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        userId: m.userId,
        user: {
          id: m.user.id,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
        },
      })
    }

    return NextResponse.json({
      messages,
      hasMore: messagesRaw.length === limit,
    })
  } catch (error) {
    console.error("メッセージ取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// メッセージ送信
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId, content } = await request.json()

    if (!channelId || !content?.trim()) {
      return NextResponse.json(
        { error: "チャンネルIDとメッセージ内容は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // チャンネルメンバーか確認
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: auth.userId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "このチャンネルのメンバーではありません" },
        { status: 403 }
      )
    }

    const message = await prisma.message.create({
      data: {
        channelId,
        userId: auth.userId,
        content: content.trim(),
      },
    })

    return NextResponse.json({ id: message.id })
  } catch (error) {
    console.error("メッセージ送信エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
