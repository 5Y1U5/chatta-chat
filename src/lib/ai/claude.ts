// Anthropic Claude API ラッパー（Chatta から流用）

import Anthropic from "@anthropic-ai/sdk"
import { DEFAULT_MODEL } from "./providers"

let client: Anthropic | undefined

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

type Message = { role: "user" | "assistant"; content: string }

// リトライ付き Claude API 呼び出し（最大3回、exponential backoff）
export async function callClaude(
  systemPrompt: string,
  messages: Message[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const anthropic = getClient()
  const maxRetries = 3
  const model = options?.model ?? DEFAULT_MODEL
  const maxTokens = options?.maxTokens ?? 1024

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      })

      const block = response.content[0]
      if (block.type === "text") {
        return block.text
      }
      throw new Error("テキスト以外のレスポンス")
    } catch (err) {
      if (attempt === maxRetries - 1) throw err
      const delay = Math.pow(2, attempt) * 1000
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw new Error("Claude API 呼び出しに失敗しました")
}
