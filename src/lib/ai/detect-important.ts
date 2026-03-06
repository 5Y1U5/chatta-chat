// 会話から重要事項を自動検出するロジック

import { callClaude } from "./claude"
import { getPrisma } from "@/lib/prisma"

const DETECT_SYSTEM_PROMPT = `あなたはチャットの会話を分析し、重要な事項を検出するAIアシスタントです。

以下のカテゴリに該当する重要事項を検出してください:
- decision: 決定事項（「〜に決まった」「〜で行く」など）
- deadline: 期限・スケジュール（「〜までに」「〜日に」など）
- action: アクションアイテム（「〜する」「〜を担当」など）
- info: 重要な情報（数値、URL、仕様変更など）

ルール:
- 重要でない雑談や挨拶は無視してください
- 検出した場合のみ出力してください。重要事項がなければ「なし」と出力してください
- 各項目を以下の形式で出力してください（1行1項目）:
[カテゴリ] 内容

出力例:
[decision] 次回ミーティングはオンラインで実施する
[deadline] 提案書の締切は3月15日
[action] 田中さんがデザイン案を作成する`

// 直近のメッセージから重要事項を検出してDBに保存
export async function detectImportantItems(
  channelId: string,
  messageIds: string[]
) {
  const prisma = getPrisma()

  // 対象メッセージを取得
  const messages = await prisma.message.findMany({
    where: {
      id: { in: messageIds },
      deletedAt: null,
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  })

  if (messages.length === 0) return

  // AI 生成メッセージは除外
  const humanMessages = messages.filter((m) => !m.aiGenerated)
  if (humanMessages.length === 0) return

  const conversationText = humanMessages
    .map((m) => `${m.user.displayName || "ユーザー"}: ${m.content}`)
    .join("\n")

  try {
    const response = await callClaude(
      DETECT_SYSTEM_PROMPT,
      [{ role: "user", content: `以下の会話から重要事項を検出してください:\n\n${conversationText}` }],
      { maxTokens: 512 }
    )

    if (response.trim() === "なし") return

    // パース: [category] content
    const lines = response.split("\n").filter((l) => l.trim())
    const validCategories = ["decision", "deadline", "action", "info"]

    for (const line of lines) {
      const match = line.match(/^\[(\w+)\]\s*(.+)$/)
      if (match) {
        const category = match[1]
        const content = match[2].trim()
        if (validCategories.includes(category) && content) {
          await prisma.channelMemory.create({
            data: {
              channelId,
              content,
              category,
              sourceMessageId: humanMessages[humanMessages.length - 1].id,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error("重要事項検出エラー:", err)
  }
}
