// @AI メンション応答ロジック

import { callClaude } from "./claude"
import { getPrisma } from "@/lib/prisma"

const SYSTEM_PROMPT = `あなたは chatta-chat のAIアシスタントです。
グループチャット内で @AI とメンションされた時に応答します。

ルール:
- 簡潔で親しみやすい口調で回答してください
- 技術的な質問には正確に答えてください
- 分からないことは正直に伝えてください
- 日本語で回答してください
- マークダウン記法は使わず、プレーンテキストで回答してください`

// @AI メンションを検出（先頭・途中どちらでも可）
export function detectAiMention(content: string): boolean {
  return /@AI\b/i.test(content)
}

// @AI メンションを除去してユーザーの質問を抽出
function extractQuestion(content: string): string {
  return content.replace(/@AI\b/gi, "").trim()
}

// AI 応答を生成してメッセージとして保存
export async function generateAiResponse(
  channelId: string,
  triggerMessageId: string,
  triggerContent: string,
  triggerUserId: string
) {
  const prisma = getPrisma()

  try {
    // 直近の会話コンテキストを取得（最新10件）
    const recentMessages = await prisma.message.findMany({
      where: {
        channelId,
        parentId: null,
        deletedAt: null,
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    // 古い順に並べる
    recentMessages.reverse()

    // Claude API 用のメッセージ配列を構築
    type ClaudeMessage = { role: "user" | "assistant"; content: string }
    const messages: ClaudeMessage[] = []

    for (const msg of recentMessages) {
      if (msg.aiGenerated) {
        messages.push({ role: "assistant", content: msg.content })
      } else {
        const name = msg.user.displayName || "ユーザー"
        const content = msg.id === triggerMessageId
          ? `${name}: ${extractQuestion(msg.content)}`
          : `${name}: ${msg.content}`
        messages.push({ role: "user", content })
      }
    }

    // 直近メッセージがなければトリガーメッセージだけ
    if (messages.length === 0) {
      messages.push({ role: "user", content: extractQuestion(triggerContent) })
    }

    // 末尾が assistant の場合、Claude API がエラーになるので調整
    if (messages[messages.length - 1].role === "assistant") {
      messages.push({ role: "user", content: extractQuestion(triggerContent) })
    }

    // Claude API 呼び出し
    const response = await callClaude(SYSTEM_PROMPT, messages)

    // AI 用ユーザーを取得 or 作成
    const aiUser = await getOrCreateAiUser(channelId)

    // 応答をメッセージとして保存
    await prisma.message.create({
      data: {
        channelId,
        userId: aiUser.id,
        content: response,
        aiGenerated: true,
      },
    })
  } catch (err) {
    console.error("AI 応答生成の内部エラー:", err)
    // エラー時はエラーメッセージをチャットに投稿（ユーザーに見えるように）
    try {
      const aiUser = await getOrCreateAiUser(channelId)
      const errorDetail = err instanceof Error ? err.message : "不明なエラー"
      await prisma.message.create({
        data: {
          channelId,
          userId: aiUser.id,
          content: `AI 応答の生成に失敗しました: ${errorDetail}`,
          aiGenerated: true,
        },
      })
    } catch (innerErr) {
      console.error("AI エラーメッセージ投稿も失敗:", innerErr)
    }
  }
}

// AI ユーザーを取得（なければ作成）
export async function getOrCreateAiUser(channelId: string) {
  const prisma = getPrisma()

  // AI ユーザーを検索
  let aiUser = await prisma.user.findFirst({
    where: { email: "ai@chatta-chat.local" },
  })

  if (!aiUser) {
    // AI ユーザー作成
    aiUser = await prisma.user.create({
      data: {
        supabaseUserId: "ai-assistant-" + crypto.randomUUID(),
        email: "ai@chatta-chat.local",
        displayName: "AI アシスタント",
      },
    })
  }

  // チャンネルメンバーに追加（未加入の場合）
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  })

  if (channel) {
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: aiUser.id,
        },
      },
    })

    if (!membership) {
      await prisma.channelMember.create({
        data: {
          channelId,
          userId: aiUser.id,
        },
      })

      // ワークスペースメンバーにも追加
      const wsMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: channel.workspaceId,
            userId: aiUser.id,
          },
        },
      })

      if (!wsMembership) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: channel.workspaceId,
            userId: aiUser.id,
            role: "member",
          },
        })
      }
    }
  }

  return aiUser
}
