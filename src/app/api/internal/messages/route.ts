import { NextRequest, NextResponse, after } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { detectAiMention, generateAiResponse } from "@/lib/ai/assistant"

// 過去メッセージ取得（カーソルベースページネーション）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")
    const cursor = searchParams.get("cursor") // 最古メッセージのID
    const parentId = searchParams.get("parentId") // スレッド返信取得用
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
        deletedAt: null,
        // parentId フィルタ: スレッド返信 or ルートメッセージ
        parentId: parentId || null,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: {
        user: true,
        reactions: true,
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    // 古い順に並び替え
    messagesRaw.reverse()

    const messages: {
      id: string
      content: string
      createdAt: string
      updatedAt: string
      userId: string
      parentId: string | null
      aiGenerated: boolean
      deletedAt: string | null
      replyCount: number
      reactions: { emoji: string; count: number; userReacted: boolean }[]
      user: { id: string; displayName: string | null; avatarUrl: string | null }
    }[] = []
    for (const m of messagesRaw) {
      // リアクション集計
      const emojiMap = new Map<string, { count: number; userReacted: boolean }>()
      for (const r of m.reactions) {
        const entry = emojiMap.get(r.emoji) || { count: 0, userReacted: false }
        entry.count++
        if (r.userId === auth.userId) entry.userReacted = true
        emojiMap.set(r.emoji, entry)
      }
      const reactions: { emoji: string; count: number; userReacted: boolean }[] = []
      for (const [emoji, info] of emojiMap) {
        reactions.push({ emoji, count: info.count, userReacted: info.userReacted })
      }

      messages.push({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        userId: m.userId,
        parentId: m.parentId,
        aiGenerated: m.aiGenerated,
        deletedAt: m.deletedAt?.toISOString() || null,
        replyCount: m._count.replies,
        reactions,
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
    const { channelId, content, parentId } = await request.json()

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

    // parentId が指定されている場合、親メッセージの存在確認
    if (parentId) {
      const parent = await prisma.message.findFirst({
        where: { id: parentId, channelId, deletedAt: null },
      })
      if (!parent) {
        return NextResponse.json(
          { error: "親メッセージが見つかりません" },
          { status: 404 }
        )
      }
    }

    const trimmedContent = content.trim()

    const message = await prisma.message.create({
      data: {
        channelId,
        userId: auth.userId,
        content: trimmedContent,
        parentId: parentId || null,
      },
    })

    // @AI メンション検出 → レスポンス送信後に AI 応答を生成
    // after() で Vercel サーバーレス環境でもバックグラウンド処理を完了させる
    if (detectAiMention(trimmedContent) && !parentId) {
      after(async () => {
        try {
          await generateAiResponse(channelId, message.id, trimmedContent, auth.userId)
        } catch (err) {
          console.error("AI 応答生成エラー:", err)
        }
      })
    }

    return NextResponse.json({ id: message.id })
  } catch (error) {
    console.error("メッセージ送信エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// メッセージ編集
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { messageId, content } = await request.json()

    if (!messageId || !content?.trim()) {
      return NextResponse.json(
        { error: "メッセージIDと内容は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message || message.deletedAt) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 }
      )
    }

    // 本人のみ編集可能
    if (message.userId !== auth.userId) {
      return NextResponse.json(
        { error: "自分のメッセージのみ編集できます" },
        { status: 403 }
      )
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim() },
    })

    return NextResponse.json({ id: updated.id })
  } catch (error) {
    console.error("メッセージ編集エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// メッセージ削除（ソフトデリート）
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json(
        { error: "メッセージIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message || message.deletedAt) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 }
      )
    }

    // 本人 or admin のみ削除可能
    if (message.userId !== auth.userId && auth.role !== "admin") {
      return NextResponse.json(
        { error: "削除権限がありません" },
        { status: 403 }
      )
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("メッセージ削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
