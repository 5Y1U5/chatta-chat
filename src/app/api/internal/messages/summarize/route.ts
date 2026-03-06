import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { callClaude } from "@/lib/ai/claude"

const SUMMARY_SYSTEM_PROMPT = `あなたはチャットの会話を要約するAIアシスタントです。

ルール:
- 会話の要点を箇条書きで簡潔にまとめてください
- 決定事項、アクションアイテム、重要な情報を優先的に抽出してください
- 発言者名を含めて、誰が何を言ったか分かるようにしてください
- 日本語で出力してください
- 以下の構造で出力してください:

【要約】
（会話全体の概要を1-2文で）

【主要な議論・決定事項】
- 項目1
- 項目2

【アクションアイテム】
- 担当者: タスク内容

【その他のポイント】
- 補足情報があれば`

// 会話要約 API
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { channelId, hours = 24 } = await request.json()

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

    // 指定時間内のメッセージを取得
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        parentId: null,
        deletedAt: null,
        createdAt: { gte: since },
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 200, // 要約対象は最大200件
    })

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "指定期間のメッセージがありません" },
        { status: 400 }
      )
    }

    // メッセージを会話テキストに変換
    const conversationText = messages
      .map((m) => {
        const name = m.user.displayName || "ユーザー"
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

    // Claude API で要約
    const summary = await callClaude(
      SUMMARY_SYSTEM_PROMPT,
      [{ role: "user", content: `以下の会話を要約してください:\n\n${conversationText}` }],
      { maxTokens: 2048 }
    )

    return NextResponse.json({
      summary,
      messageCount: messages.length,
      period: {
        from: messages[0].createdAt.toISOString(),
        to: messages[messages.length - 1].createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("会話要約エラー:", error)
    return NextResponse.json(
      { error: "要約の生成に失敗しました" },
      { status: 500 }
    )
  }
}
