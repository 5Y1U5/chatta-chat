"use client"

import { useState } from "react"
import { format, addDays, nextMonday } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: Date | undefined
  onConfirm: (date: Date | undefined) => void
}

export function DueDateDrawer({ open, onOpenChange, value, onConfirm }: Props) {
  const [selected, setSelected] = useState<Date | undefined>(value)

  // Drawer が開くたびに現在値で初期化
  const handleOpenChange = (o: boolean) => {
    if (o) setSelected(value)
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
          <div className="mt-3">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setSelected}
              locale={ja}
              className="mx-auto"
            />
          </div>

          {/* 完了ボタン */}
          <div className="mt-4">
            <Button
              className="w-full h-12 text-base font-medium"
              onClick={() => {
                onConfirm(selected)
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
