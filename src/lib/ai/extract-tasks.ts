// チャット会話からタスクを自動抽出・登録するロジック

import { callClaude } from "./claude"
import { getOrCreateAiUser } from "./assistant"
import { getPrisma } from "@/lib/prisma"

const TASK_EXTRACTION_PROMPT = `あなたはチャット会話からタスクを抽出するアシスタントです。

以下の会話内容を分析し、タスクとして登録すべき内容を構造化してください。

ルール:
- 大きなテーマや目標を親タスクとして抽出してください
- 具体的なアクションや作業項目をサブタスクとして親タスクに紐付けてください
- 会話から読み取れる優先度があれば設定してください（high / medium / low）
- 期限が明示されていれば ISO 8601 形式（YYYY-MM-DD）で設定してください
- 会話に含まれない情報は推測せず null としてください
- タスクが1つだけの場合もサブタスクがあれば含めてください

必ず以下の JSON 配列形式のみで回答してください（説明文は不要）:
[
  {
    "title": "親タスク名",
    "description": "タスクの説明（任意）",
    "priority": "high" | "medium" | "low",
    "dueDate": "YYYY-MM-DD" | null,
    "subTasks": [
      {
        "title": "サブタスク名",
        "priority": "high" | "medium" | "low",
        "dueDate": "YYYY-MM-DD" | null
      }
    ]
  }
]`

// タスク登録リクエストを検出
export function detectTaskRequest(content: string): boolean {
  const patterns = [
    /タスクに登録/,
    /タスクにして/,
    /タスク化/,
    /タスクを作成/,
    /タスクに追加/,
    /タスクを登録/,
    /タスク作って/,
    /タスクに起こ/,
    /タスクにまとめ/,
    /タスクとして/,
    /todo[にを]/, // 「todoに登録」「todoを作成」
  ]
  const lower = content.toLowerCase()
  return patterns.some((p) => p.test(lower))
}

// チャット会話からタスクを抽出して登録
export async function extractTasksFromChat(
  channelId: string,
  triggerUserId: string,
  workspaceId: string
) {
  const prisma = getPrisma()

  try {
    // 直近20件のメッセージを取得（AI生成メッセージを除外）
    const recentMessages = await prisma.message.findMany({
      where: {
        channelId,
        parentId: null,
        deletedAt: null,
        aiGenerated: false,
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    if (recentMessages.length === 0) {
      const aiUser = await getOrCreateAiUser(channelId)
      await prisma.message.create({
        data: {
          channelId,
          userId: aiUser.id,
          content: "タスクに登録できる会話が見つかりませんでした。",
          aiGenerated: true,
        },
      })
      return
    }

    // 古い順に並べる
    recentMessages.reverse()

    // 会話テキストを構築
    const conversationText = recentMessages
      .map((msg) => {
        const name = msg.user.displayName || "ユーザー"
        return `${name}: ${msg.content}`
      })
      .join("\n")

    // Claude API でタスクを抽出
    const response = await callClaude(
      TASK_EXTRACTION_PROMPT,
      [{ role: "user", content: conversationText }],
      { maxTokens: 2048 }
    )

    // JSON をパース
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error("AIからの応答をパースできませんでした")
    }

    type ExtractedSubTask = {
      title: string
      priority?: string
      dueDate?: string | null
    }
    type ExtractedTask = {
      title: string
      description?: string | null
      priority?: string
      dueDate?: string | null
      subTasks?: ExtractedSubTask[]
    }

    const extractedTasks: ExtractedTask[] = JSON.parse(jsonMatch[0])

    if (!Array.isArray(extractedTasks) || extractedTasks.length === 0) {
      const aiUser = await getOrCreateAiUser(channelId)
      await prisma.message.create({
        data: {
          channelId,
          userId: aiUser.id,
          content: "会話からタスクを抽出できませんでした。もう少し具体的な内容があると登録しやすくなります。",
          aiGenerated: true,
        },
      })
      return
    }

    // タスクを一括作成
    const createdTasks: { title: string; priority: string; dueDate: string | null; subTasks: string[] }[] = []

    for (const task of extractedTasks) {
      const validPriority = ["high", "medium", "low"].includes(task.priority || "")
        ? task.priority!
        : "medium"

      // 親タスク作成
      const parentTask = await prisma.task.create({
        data: {
          workspaceId,
          title: task.title.trim(),
          description: task.description?.trim() || null,
          priority: validPriority,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          creatorId: triggerUserId,
        },
      })

      const subTaskTitles: string[] = []

      // サブタスク作成
      if (task.subTasks && task.subTasks.length > 0) {
        for (const sub of task.subTasks.slice(0, 15)) { // 上限15個
          const subPriority = ["high", "medium", "low"].includes(sub.priority || "")
            ? sub.priority!
            : validPriority

          await prisma.task.create({
            data: {
              workspaceId,
              title: sub.title.trim(),
              parentTaskId: parentTask.id,
              priority: subPriority,
              dueDate: sub.dueDate ? new Date(sub.dueDate) : null,
              creatorId: triggerUserId,
            },
          })
          subTaskTitles.push(sub.title.trim())
        }
      }

      createdTasks.push({
        title: task.title.trim(),
        priority: validPriority,
        dueDate: task.dueDate || null,
        subTasks: subTaskTitles,
      })
    }

    // 結果をチャットに投稿
    const aiUser = await getOrCreateAiUser(channelId)
    const summary = formatTaskSummary(createdTasks)
    await prisma.message.create({
      data: {
        channelId,
        userId: aiUser.id,
        content: summary,
        aiGenerated: true,
      },
    })
  } catch (err) {
    console.error("タスク抽出エラー:", err)
    try {
      const aiUser = await getOrCreateAiUser(channelId)
      const errorDetail = err instanceof Error ? err.message : "不明なエラー"
      await prisma.message.create({
        data: {
          channelId,
          userId: aiUser.id,
          content: `タスクの登録に失敗しました: ${errorDetail}`,
          aiGenerated: true,
        },
      })
    } catch (innerErr) {
      console.error("タスク抽出エラーメッセージ投稿も失敗:", innerErr)
    }
  }
}

// タスク登録結果のサマリーをフォーマット
function formatTaskSummary(
  tasks: { title: string; priority: string; dueDate: string | null; subTasks: string[] }[]
): string {
  const priorityLabel: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  }

  let summary = "会話からタスクを登録しました\n"

  for (const task of tasks) {
    const meta: string[] = []
    meta.push(`優先度: ${priorityLabel[task.priority] || "中"}`)
    if (task.dueDate) {
      const d = new Date(task.dueDate)
      meta.push(`期限: ${d.getMonth() + 1}/${d.getDate()}`)
    }

    summary += `\n${task.title}（${meta.join(" / ")}）`

    for (const sub of task.subTasks) {
      summary += `\n  - ${sub}`
    }
  }

  return summary
}
