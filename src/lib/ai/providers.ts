// LLM プロバイダーとモデル定義（Chatta から流用・簡略化）

export type LlmProvider = "anthropic" | "openai" | "google"

export type LlmModelDef = {
  id: string
  provider: LlmProvider
  label: string
}

export const LLM_MODELS: LlmModelDef[] = [
  { id: "claude-sonnet-4-6", provider: "anthropic", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", provider: "anthropic", label: "Claude Haiku 4.5" },
]

export const DEFAULT_MODEL = "claude-sonnet-4-6"

export function getProvider(modelId: string): LlmProvider {
  const model = LLM_MODELS.find((m) => m.id === modelId)
  return model?.provider ?? "anthropic"
}
