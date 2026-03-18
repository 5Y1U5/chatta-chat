"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  channelId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const PERIOD_OPTIONS = [
  { value: "1", label: "直近1時間" },
  { value: "3", label: "直近3時間" },
  { value: "6", label: "直近6時間" },
  { value: "12", label: "直近12時間" },
  { value: "24", label: "直近24時間" },
  { value: "72", label: "直近3日間" },
  { value: "168", label: "直近1週間" },
]

export function SummarizeDialog({ channelId, open: externalOpen, onOpenChange: externalOnOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen
  const [hours, setHours] = useState("24")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    summary: string
    messageCount: number
    period: { from: string; to: string }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSummarize = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/internal/messages/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, hours: Number(hours) }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "要約の生成に失敗しました")
        return
      }

      setResult(await res.json())
    } catch {
      setError("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setResult(null)
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>会話の要約</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                要約する期間を選択してください
              </label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleSummarize}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI が要約中...
                </span>
              ) : (
                "要約を生成"
              )}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{result.messageCount}件のメッセージを要約</span>
              <span>|</span>
              <span>
                {new Date(result.period.from).toLocaleString("ja-JP", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" 〜 "}
                {new Date(result.period.to).toLocaleString("ja-JP", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
              {result.summary}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.summary)
                }}
              >
                コピー
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null)
                  setError(null)
                }}
              >
                別の期間で再生成
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
