import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { callClaude } from "@/lib/ai/claude"

const MINUTES_SYSTEM_PROMPT = `あなたは会議の議事録を作成するAIアシスタントです。

チャットの会話内容から正式な議事録を作成してください。

以下の構造で出力してください:

# 議事録

## 基本情報
- 日時: （会話の期間）
- 参加者: （会話に参加したメンバー）

## 議題・討議内容
（話し合われた内容を議題ごとにまとめる）

## 決定事項
- （決まったことを箇条書き）

## アクションアイテム
- 【担当者】タスク内容（期限があれば記載）

## 次回に向けて
- （次のステップや宿題事項）

ルール:
- 日本語で出力してください
- 発言者名を含めて、誰が何を言ったか分かるようにしてください
- 雑談や挨拶は省略してOKです
- 決定事項とアクションアイテムは特に丁寧に抽出してください`

// 議事録生成 API
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId, startTime, endTime } = await request.json()

    if (!channelId) {
      return NextResponse.json(
        { error: "チャンネルIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // チャンネルメンバーか確認
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: { channelId, userId: auth.userId },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "このグループチャットのメンバーではありません" },
        { status: 403 }
      )
    }

    // 期間のメッセージを取得
    const where: Record<string, unknown> = {
      channelId,
      parentId: null,
      deletedAt: null,
    }

    if (startTime || endTime) {
      where.createdAt = {
        ...(startTime && { gte: new Date(startTime) }),
        ...(endTime && { lte: new Date(endTime) }),
      }
    } else {
      // デフォルト: 直近24時間
      where.createdAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }

    const messages = await prisma.message.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 300,
    })

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "指定期間のメッセージがありません" },
        { status: 400 }
      )
    }

    // 参加者を抽出
    const participants = new Set<string>()
    const conversationText = messages
      .map((m) => {
        const name = m.user.displayName || "ユーザー"
        if (!m.aiGenerated) participants.add(name)
        const time = m.createdAt.toLocaleString("ja-JP", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        const aiTag = m.aiGenerated ? " [AI]" : ""
        return `[${time}] ${name}${aiTag}: ${m.content}`
      })
      .join("\n")

    // Claude API で議事録生成
    const minutes = await callClaude(
      MINUTES_SYSTEM_PROMPT,
      [
        {
          role: "user",
          content: `以下の会話から議事録を作成してください。\n\n参加者: ${Array.from(participants).join("、")}\n\n${conversationText}`,
        },
      ],
      { maxTokens: 4096 }
    )

    return NextResponse.json({
      minutes,
      messageCount: messages.length,
      participants: Array.from(participants),
      period: {
        from: messages[0].createdAt.toISOString(),
        to: messages[messages.length - 1].createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("議事録生成エラー:", error)
    return NextResponse.json(
      { error: "議事録の生成に失敗しました" },
      { status: 500 }
    )
  }
}
