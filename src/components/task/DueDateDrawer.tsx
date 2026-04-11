"use client"

import { useState } from "react"
import { format, addDays, nextMonday } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer"
import { RecurrenceSelect } from "@/components/task/RecurrenceSelect"
import { Button } from "@/components/ui/button"
import { rruleToText } from "@/lib/recurrence"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: Date | undefined
  startDate?: Date | undefined
  recurrenceRule?: string | null
  onConfirm: (date: Date | undefined, opts?: { startDate?: Date | null; recurrenceRule?: string | null }) => void
}

export function DueDateDrawer({ open, onOpenChange, value, startDate: initialStartDate, recurrenceRule, onConfirm }: Props) {
  const [endDate, setEndDate] = useState<Date | undefined>(value)
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate)
  const [rangeMode, setRangeMode] = useState(!!initialStartDate)
  // rangeMode 時にどちらの日付を選択中か
  const [editingField, setEditingField] = useState<"start" | "end">("end")
  const [rule, setRule] = useState<string | null>(recurrenceRule || null)
  const [showExtras, setShowExtras] = useState(false)

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setEndDate(value)
      setStartDate(initialStartDate)
      setRangeMode(!!initialStartDate)
      setEditingField("end")
      setRule(recurrenceRule || null)
      setShowExtras(false)
    }
    onOpenChange(o)
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrow = addDays(todayStart, 1)
  const nextMon = nextMonday(todayStart)

  const quickButtons = [
    { label: "今日", date: todayStart },
    { label: "明日", date: tomorrow },
    { label: "来週の月曜日", date: nextMon },
  ]

  const isSameDay = (a: Date | undefined, b: Date) =>
    a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!rangeMode) {
      setEndDate(date)
      return
    }
    if (editingField === "start") {
      setStartDate(date)
      // 開始日が終了日より後なら終了日をクリア
      if (date && endDate && date > endDate) setEndDate(undefined)
      setEditingField("end")
    } else {
      // 終了日が開始日より前なら開始日に設定し直す
      if (date && startDate && date < startDate) {
        setStartDate(date)
      } else {
        setEndDate(date)
      }
    }
  }

  const handleQuickSelect = (date: Date) => {
    if (rangeMode && editingField === "start") {
      setStartDate(date)
      if (endDate && date > endDate) setEndDate(undefined)
      setEditingField("end")
    } else {
      setEndDate(date)
    }
  }

  const enableRangeMode = () => {
    setRangeMode(true)
    setEditingField("start")
  }

  const disableRangeMode = () => {
    setRangeMode(false)
    setStartDate(undefined)
    setEditingField("end")
  }

  const formatDate = (d: Date | undefined) =>
    d ? format(d, "M月d日(E)", { locale: ja }) : undefined

  // カレンダーのハイライト範囲
  const calendarModifiers = rangeMode && startDate && endDate
    ? { range: { from: startDate, to: endDate } }
    : undefined

  const calendarModifiersClassNames = rangeMode && startDate && endDate
    ? { range: "bg-primary/10 rounded-none" }
    : undefined

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <div className="flex flex-col px-5 pb-8 max-h-[92dvh] overflow-y-auto">
          {/* キャンセル */}
          <DrawerClose asChild>
            <button className="self-start text-sm text-blue-500 font-medium py-2">
              キャンセル
            </button>
          </DrawerClose>

          {/* 日付フィールド */}
          <div className="flex items-center gap-2 mt-4">
            {!rangeMode ? (
              <>
                {/* 単一期日モード */}
                <div
                  className={cn(
                    "flex-1 flex items-center justify-between rounded-lg px-3 py-3",
                    endDate ? "bg-muted" : "bg-muted/50"
                  )}
                >
                  <span className={cn("text-sm font-medium", !endDate && "text-muted-foreground")}>
                    {formatDate(endDate) || "期日なし"}
                  </span>
                  {endDate && (
                    <button
                      onClick={() => setEndDate(undefined)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  onClick={enableRangeMode}
                  className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  日付範囲を追加
                </button>
              </>
            ) : (
              <>
                {/* 日付範囲モード: 開始日 */}
                <button
                  onClick={() => setEditingField("start")}
                  className={cn(
                    "flex-1 flex items-center justify-between rounded-lg px-3 py-3 transition-colors",
                    editingField === "start"
                      ? "ring-2 ring-blue-500 bg-muted"
                      : startDate ? "bg-muted" : "bg-muted/50"
                  )}
                >
                  <span className={cn("text-xs text-muted-foreground mr-1")}>開始</span>
                  <span className={cn("text-sm font-medium", !startDate && "text-muted-foreground")}>
                    {formatDate(startDate) || "未設定"}
                  </span>
                </button>
                <span className="text-muted-foreground text-sm">→</span>
                {/* 日付範囲モード: 終了日 */}
                <button
                  onClick={() => setEditingField("end")}
                  className={cn(
                    "flex-1 flex items-center justify-between rounded-lg px-3 py-3 transition-colors",
                    editingField === "end"
                      ? "ring-2 ring-blue-500 bg-muted"
                      : endDate ? "bg-muted" : "bg-muted/50"
                  )}
                >
                  <span className={cn("text-xs text-muted-foreground mr-1")}>終了</span>
                  <span className={cn("text-sm font-medium", !endDate && "text-muted-foreground")}>
                    {formatDate(endDate) || "未設定"}
                  </span>
                </button>
                {/* 範囲モード解除 */}
                <button
                  onClick={disableRangeMode}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* クイック選択ボタン */}
          <div className="flex gap-2 mt-4">
            {quickButtons.map((qb) => {
              const isActive = rangeMode
                ? (editingField === "start" ? isSameDay(startDate, qb.date) : isSameDay(endDate, qb.date))
                : isSameDay(endDate, qb.date)
              return (
                <button
                  key={qb.label}
                  onClick={() => handleQuickSelect(qb.date)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-blue-500 bg-blue-500/10 text-blue-500"
                      : "border-border text-foreground"
                  )}
                >
                  {qb.label}
                </button>
              )
            })}
          </div>

          {/* カレンダー */}
          <div className="mt-4 relative">
            <Calendar
              mode="single"
              selected={rangeMode ? (editingField === "start" ? startDate : endDate) : endDate}
              onSelect={handleCalendarSelect}
              locale={ja}
              className="w-full"
              classNames={{ root: "w-full" }}
              modifiers={calendarModifiers}
              modifiersClassNames={calendarModifiersClassNames}
            />

            {/* その他のポップオーバー */}
            {showExtras && (
              <div className="absolute bottom-2 left-2 z-10 rounded-lg border bg-popover p-2 shadow-lg min-w-[200px]">
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <span className="text-sm font-medium">繰り返しに設定</span>
                  </div>
                  <RecurrenceSelect
                    value={rule}
                    onChange={(newRule) => {
                      setRule(newRule)
                      setShowExtras(false)
                    }}
                    dueDate={endDate}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 繰り返し設定中の表示 */}
          {rule && (
            <div className="flex items-center gap-2 mt-1 px-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="text-xs text-blue-500 font-medium">{rruleToText(rule)}</span>
              <button
                onClick={() => setRule(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* その他 + 完了ボタン */}
          <div className="flex gap-3 mt-5">
            <Button
              variant="outline"
              className="flex-1 h-12 text-base font-medium"
              onClick={() => setShowExtras((prev) => !prev)}
            >
              その他
            </Button>
            <Button
              className="flex-1 h-12 text-base font-medium"
              onClick={() => {
                onConfirm(endDate, {
                  startDate: rangeMode ? (startDate || null) : null,
                  recurrenceRule: rule,
                })
                onOpenChange(false)
              }}
            >
              完了
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
