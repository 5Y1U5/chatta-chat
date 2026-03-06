import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { callClaude } from "@/lib/ai/claude"

const SYSTEM_PROMPT = `あなたはチャットの返信文を提案するAIアシスタントです。

直近の会話の流れを理解し、ユーザーが送りそうな返信を3パターン提案してください。

ルール:
- 3パターンを改行区切りで出力してください（番号なし、余計な説明なし）
- 1つ目: 丁寧な返信
- 2つ目: カジュアルな返信
- 3つ目: 簡潔な返信
- 各返信は1〜2文で短くしてください
- 日本語で出力してください
- マークダウン記法は使わないでください
- 区切り文字として --- を各返信の間に入れてください

出力例:
承知しました。確認して折り返しご連絡いたします。
---
了解！確認するね。
---
確認します。`

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId } = await request.json()

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

    // 直近のメッセージを取得
    const recentMessages = await prisma.message.findMany({
      where: {
        channelId,
        parentId: null,
        deletedAt: null,
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    })

    recentMessages.reverse()

    if (recentMessages.length === 0) {
      return NextResponse.json(
        { error: "会話がまだありません" },
        { status: 400 }
      )
    }

    // 会話テキストを構築
    const conversationText = recentMessages
      .map((m) => {
        const name = m.user.displayName || "ユーザー"
        const isMe = m.userId === auth.userId ? " (自分)" : ""
        return `${name}${isMe}: ${m.content}`
      })
      .join("\n")

    // 現在のユーザー名を取得
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { displayName: true },
    })
    const myName = currentUser?.displayName || "ユーザー"

    const response = await callClaude(
      SYSTEM_PROMPT,
      [
        {
          role: "user",
          content: `以下の会話に対する「${myName}」の返信を3パターン提案してください:\n\n${conversationText}`,
        },
      ],
      { maxTokens: 512 }
    )

    // --- で分割して3パターンを抽出
    const suggestions = response
      .split("---")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("返信提案エラー:", error)
    return NextResponse.json(
      { error: "返信の提案に失敗しました" },
      { status: 500 }
    )
  }
}
