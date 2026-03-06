"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

type Props = {
  channelId: string
}

export function MinutesDialog({ channelId }: Props) {
  const [open, setOpen] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    minutes: string
    messageCount: number
    participants: string[]
    period: { from: string; to: string }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/internal/messages/minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "議事録の生成に失敗しました")
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
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="議事録を作成"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14h6" />
            <path d="M9 18h6" />
            <path d="M9 10h6" />
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>議事録の作成</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              チャットの会話内容から議事録を自動生成します。期間を指定しない場合は直近24時間が対象です。
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">開始日時（任意）</label>
                <Input
                  type="datetime-local"
                  className="text-sm"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">終了日時（任意）</label>
                <Input
                  type="datetime-local"
                  className="text-sm"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI が議事録を作成中...
                </span>
              ) : (
                "議事録を生成"
              )}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{result.messageCount}件のメッセージ</span>
              <span>|</span>
              <span>参加者: {result.participants.join("、")}</span>
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
              {result.minutes}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(result.minutes)}
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
