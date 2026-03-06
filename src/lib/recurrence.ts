// 繰り返しタスク: RRULE のパース・生成・次回日時計算

import { RRule, Frequency } from "rrule"

// UI 用の繰り返しプリセット
export type RecurrencePreset =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "custom"

// UI 表示用のプリセット定義
export const RECURRENCE_PRESETS: { value: RecurrencePreset; label: string }[] = [
  { value: "none", label: "繰り返しなし" },
  { value: "daily", label: "毎日" },
  { value: "weekdays", label: "平日のみ" },
  { value: "weekly", label: "毎週" },
  { value: "biweekly", label: "隔週" },
  { value: "monthly", label: "毎月" },
  { value: "yearly", label: "毎年" },
]

// プリセットから RRULE 文字列を生成
export function presetToRRule(preset: RecurrencePreset, dtstart?: Date): string | null {
  if (preset === "none" || preset === "custom") return null

  const start = dtstart || new Date()

  const ruleMap: Record<string, Partial<ConstructorParameters<typeof RRule>[0]>> = {
    daily: { freq: Frequency.DAILY, interval: 1 },
    weekdays: { freq: Frequency.WEEKLY, byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR] },
    weekly: { freq: Frequency.WEEKLY, interval: 1 },
    biweekly: { freq: Frequency.WEEKLY, interval: 2 },
    monthly: { freq: Frequency.MONTHLY, interval: 1 },
    yearly: { freq: Frequency.YEARLY, interval: 1 },
  }

  const options = ruleMap[preset]
  if (!options) return null

  const rule = new RRule({ ...options, dtstart: start })
  return rule.toString()
}

// RRULE 文字列から次回発生日を計算
export function getNextOccurrence(rruleString: string, after?: Date): Date | null {
  try {
    const rule = RRule.fromString(rruleString)
    const afterDate = after || new Date()
    const next = rule.after(afterDate)
    return next
  } catch {
    return null
  }
}

// RRULE 文字列を日本語の自然言語に変換
export function rruleToText(rruleString: string | null): string {
  if (!rruleString) return "繰り返しなし"

  try {
    const rule = RRule.fromString(rruleString)
    const freq = rule.options.freq
    const interval = rule.options.interval || 1
    const byweekday = rule.options.byweekday

    // 平日判定
    if (freq === Frequency.WEEKLY && byweekday && byweekday.length === 5) {
      const weekdays = [0, 1, 2, 3, 4] // MO-FR
      const isWeekdays = weekdays.every((d) => byweekday.includes(d))
      if (isWeekdays) return "平日のみ"
    }

    const freqLabels: Record<number, string> = {
      [Frequency.DAILY]: "日",
      [Frequency.WEEKLY]: "週",
      [Frequency.MONTHLY]: "月",
      [Frequency.YEARLY]: "年",
    }

    const freqLabel = freqLabels[freq] || "?"

    if (interval === 1) return `毎${freqLabel}`
    if (interval === 2 && freq === Frequency.WEEKLY) return "隔週"
    return `${interval}${freqLabel}ごと`
  } catch {
    return "繰り返しあり"
  }
}
