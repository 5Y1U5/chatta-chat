"use client"

import { useState, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  RECURRENCE_PRESETS,
  WEEKDAY_LABELS,
  presetToRRule,
  buildCustomRRule,
  parseRRuleToCustom,
  rruleToText,
  type RecurrencePreset,
  type FreqType,
  type CustomRecurrenceOptions,
} from "@/lib/recurrence"

type Props = {
  value: string | null // RRULE 文字列 or null
  onChange: (rrule: string | null) => void
  dueDate?: Date
  compact?: boolean // TaskDetailPanel 用の小さいスタイル
}

const FREQ_OPTIONS: { value: FreqType; label: string }[] = [
  { value: "daily", label: "日" },
  { value: "weekly", label: "週" },
  { value: "monthly", label: "ヶ月" },
  { value: "yearly", label: "年" },
]

export function RecurrenceSelect({ value, onChange, dueDate, compact }: Props) {
  const isMobile = useIsMobile()
  const [customOpen, setCustomOpen] = useState(false)
  const [customOptions, setCustomOptions] = useState<CustomRecurrenceOptions>({
    freq: "weekly",
    interval: 1,
    weekdays: [],
  })

  // 現在の RRULE がプリセットに該当するか判定
  const getCurrentPreset = useCallback((): RecurrencePreset => {
    if (!value) return "none"
    // プリセットとの一致は判定が複雑なので、カスタムとして扱う
    return "_current" as RecurrencePreset
  }, [value])

  const handlePresetChange = (preset: string) => {
    if (preset === "_current") return

    if (preset === "custom") {
      // カスタムダイアログを開く（現在値があればパース）
      setCustomOptions(parseRRuleToCustom(value))
      setCustomOpen(true)
      return
    }

    if (preset === "none") {
      onChange(null)
      return
    }

    const rrule = presetToRRule(preset as RecurrencePreset, dueDate)
    onChange(rrule)
  }

  const handleCustomConfirm = () => {
    const rrule = buildCustomRRule(customOptions, dueDate)
    onChange(rrule)
    setCustomOpen(false)
  }

  const toggleWeekday = (day: number) => {
    setCustomOptions((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b),
    }))
  }

  // カスタム設定のプレビューテキスト
  const previewText = (() => {
    const rrule = buildCustomRRule(customOptions)
    return rruleToText(rrule)
  })()

  const displayText = value ? rruleToText(value) : "なし"
  const currentPreset = getCurrentPreset()

  // カスタムダイアログの中身
  const customContent = (
    <div className="space-y-5">
      {/* 間隔設定 */}
      <div>
        <label className="text-sm font-medium mb-2 block">繰り返し間隔</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={99}
            value={customOptions.interval}
            onChange={(e) =>
              setCustomOptions((prev) => ({
                ...prev,
                interval: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)),
              }))
            }
            className="w-20 text-center"
          />
          <Select
            value={customOptions.freq}
            onValueChange={(v) =>
              setCustomOptions((prev) => ({
                ...prev,
                freq: v as FreqType,
                // 週以外に変更したら曜日をリセット
                weekdays: v === "weekly" ? prev.weekdays : [],
              }))
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQ_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">ごと</span>
        </div>
      </div>

      {/* 曜日選択（週の場合のみ） */}
      {customOptions.freq === "weekly" && (
        <div>
          <label className="text-sm font-medium mb-2 block">繰り返す曜日</label>
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((wd) => (
              <button
                key={wd.value}
                type="button"
                onClick={() => toggleWeekday(wd.value)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  customOptions.weekdays.includes(wd.value)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {wd.short}
              </button>
            ))}
          </div>
          {customOptions.weekdays.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">曜日未選択の場合、期日と同じ曜日に繰り返します</p>
          )}
        </div>
      )}

      {/* プレビュー */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">プレビュー: </span>
        <span className="text-sm font-medium">{previewText}</span>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>
          キャンセル
        </Button>
        <Button type="button" onClick={handleCustomConfirm}>
          設定
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Select
        value={value ? "_current" : "none"}
        onValueChange={handlePresetChange}
      >
        <SelectTrigger className={compact ? "h-7 text-xs" : "h-8 text-sm"}>
          <SelectValue>{displayText}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RECURRENCE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
          {/* 現在カスタム値がある場合、選択肢として表示 */}
          {value && currentPreset === ("_current" as RecurrencePreset) && (
            <SelectItem value="_current">
              {displayText}（現在の設定）
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* カスタムダイアログ */}
      {isMobile ? (
        <Sheet open={customOpen} onOpenChange={setCustomOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-2" showCloseButton={false}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <SheetHeader className="p-0 mb-4">
              <SheetTitle className="text-base">カスタム繰り返し</SheetTitle>
            </SheetHeader>
            {customContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>カスタム繰り返し</DialogTitle>
            </DialogHeader>
            {customContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
