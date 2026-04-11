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
  recurrenceRule?: string | null
  onConfirm: (date: Date | undefined, recurrenceRule?: string | null) => void
}

export function DueDateDrawer({ open, onOpenChange, value, recurrenceRule, onConfirm }: Props) {
  const [selected, setSelected] = useState<Date | undefined>(value)
  const [rule, setRule] = useState<string | null>(recurrenceRule || null)
  const [showExtras, setShowExtras] = useState(false)

  // Drawer が開くたびに現在値で初期化
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setSelected(value)
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

  const isQuickSelected = (date: Date) =>
    selected &&
    selected.getFullYear() === date.getFullYear() &&
    selected.getMonth() === date.getMonth() &&
    selected.getDate() === date.getDate()

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <div className="flex flex-col px-4 pb-6 max-h-[85dvh] overflow-y-auto">
          {/* キャンセル */}
          <DrawerClose asChild>
            <button className="self-start text-sm text-blue-500 font-medium py-1">
              キャンセル
            </button>
          </DrawerClose>

          {/* 選択中の日付表示 */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className={cn(
                "flex-1 flex items-center justify-between rounded-lg px-3 py-2.5",
                selected ? "bg-muted" : "bg-muted/50"
              )}
            >
              <span className={cn("text-sm font-medium", !selected && "text-muted-foreground")}>
                {selected
                  ? format(selected, "M月d日(E)", { locale: ja })
                  : "期日なし"}
              </span>
              {selected && (
                <button
                  onClick={() => setSelected(undefined)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* クイック選択ボタン */}
          <div className="flex gap-2 mt-3">
            {quickButtons.map((qb) => (
              <button
                key={qb.label}
                onClick={() => setSelected(qb.date)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  isQuickSelected(qb.date)
                    ? "border-blue-500 bg-blue-500/10 text-blue-500"
                    : "border-border text-foreground"
                )}
              >
                {qb.label}
              </button>
            ))}
          </div>

          {/* カレンダー */}
          <div className="mt-3 relative">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setSelected}
              locale={ja}
              className="mx-auto"
            />

            {/* その他のポップオーバー */}
            {showExtras && (
              <div className="absolute bottom-2 left-2 z-10 rounded-lg border bg-popover p-2 shadow-lg min-w-[200px]">
                {/* 繰り返しに設定 */}
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
                    dueDate={selected}
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
          <div className="flex gap-3 mt-4">
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
                onConfirm(selected, rule)
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
