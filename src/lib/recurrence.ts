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

// 頻度の種類
export type FreqType = "daily" | "weekly" | "monthly" | "yearly"

// カスタム繰り返し設定の型
export type CustomRecurrenceOptions = {
  freq: FreqType
  interval: number
  weekdays: number[] // 0=月, 1=火, ..., 6=日（RRule の weekday index）
}

// 曜日ラベル（月〜日）
export const WEEKDAY_LABELS = [
  { value: 0, label: "月", short: "月" },
  { value: 1, label: "火", short: "火" },
  { value: 2, label: "水", short: "水" },
  { value: 3, label: "木", short: "木" },
  { value: 4, label: "金", short: "金" },
  { value: 5, label: "土", short: "土" },
  { value: 6, label: "日", short: "日" },
] as const

// RRule の Weekday オブジェクト（月〜日）
const RRULE_WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

// UI 表示用のプリセット定義
export const RECURRENCE_PRESETS: { value: RecurrencePreset; label: string }[] = [
  { value: "none", label: "繰り返しなし" },
  { value: "daily", label: "毎日" },
  { value: "weekdays", label: "平日のみ" },
  { value: "weekly", label: "毎週" },
  { value: "biweekly", label: "隔週" },
  { value: "monthly", label: "毎月" },
  { value: "yearly", label: "毎年" },
  { value: "custom", label: "カスタム..." },
]

// FreqType と RRule Frequency のマッピング
const FREQ_MAP: Record<FreqType, Frequency> = {
  daily: Frequency.DAILY,
  weekly: Frequency.WEEKLY,
  monthly: Frequency.MONTHLY,
  yearly: Frequency.YEARLY,
}

const FREQ_REVERSE_MAP: Record<number, FreqType> = {
  [Frequency.DAILY]: "daily",
  [Frequency.WEEKLY]: "weekly",
  [Frequency.MONTHLY]: "monthly",
  [Frequency.YEARLY]: "yearly",
}

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

// カスタム設定から RRULE 文字列を生成
export function buildCustomRRule(options: CustomRecurrenceOptions, dtstart?: Date): string | null {
  const start = dtstart || new Date()
  const freq = FREQ_MAP[options.freq]
  if (freq === undefined) return null

  const ruleOptions: ConstructorParameters<typeof RRule>[0] = {
    freq,
    interval: Math.max(1, options.interval),
    dtstart: start,
  }

  // 週の場合、曜日指定があれば追加
  if (options.freq === "weekly" && options.weekdays.length > 0) {
    ruleOptions.byweekday = options.weekdays.map((d) => RRULE_WEEKDAYS[d])
  }

  const rule = new RRule(ruleOptions)
  return rule.toString()
}

// RRULE 文字列をカスタム設定に逆変換
export function parseRRuleToCustom(rruleString: string | null): CustomRecurrenceOptions {
  const defaults: CustomRecurrenceOptions = { freq: "weekly", interval: 1, weekdays: [] }
  if (!rruleString) return defaults

  try {
    const rule = RRule.fromString(rruleString)
    const freq = FREQ_REVERSE_MAP[rule.options.freq]
    if (!freq) return defaults

    const weekdays: number[] = []
    if (rule.options.byweekday) {
      for (const wd of rule.options.byweekday) {
        // byweekday は number (0=MO ... 6=SU)
        if (typeof wd === "number" && wd >= 0 && wd <= 6) {
          weekdays.push(wd)
        }
      }
    }

    return {
      freq,
      interval: rule.options.interval || 1,
      weekdays: weekdays.sort((a, b) => a - b),
    }
  } catch {
    return defaults
  }
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

    // 曜日のラベル生成
    const weekdaySuffix = (days: number[]): string => {
      if (!days || days.length === 0) return ""
      const sorted = [...days].sort((a, b) => a - b)
      const labels = sorted.map((d) => WEEKDAY_LABELS[d]?.short || "?")
      return `（${labels.join("・")}）`
    }

    // 平日判定
    if (freq === Frequency.WEEKLY && byweekday && byweekday.length === 5) {
      const weekdayNums = [0, 1, 2, 3, 4] // MO-FR
      const isWeekdays = weekdayNums.every((d) => byweekday.includes(d))
      if (isWeekdays) return "平日のみ"
    }

    const freqLabels: Record<number, string> = {
      [Frequency.DAILY]: "日",
      [Frequency.WEEKLY]: "週",
      [Frequency.MONTHLY]: "ヶ月",
      [Frequency.YEARLY]: "年",
    }

    const freqLabel = freqLabels[freq] || "?"

    // 曜日付きの表示
    const wdText = freq === Frequency.WEEKLY && byweekday && byweekday.length > 0
      ? weekdaySuffix(byweekday as number[])
      : ""

    if (interval === 1) {
      return `毎${freq === Frequency.MONTHLY ? "月" : freqLabel}${wdText}`
    }
    if (interval === 2 && freq === Frequency.WEEKLY && !wdText) return "隔週"
    return `${interval}${freqLabel}ごと${wdText}`
  } catch {
    return "繰り返しあり"
  }
}
