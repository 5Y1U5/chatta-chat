import type {
  Activator,
  SensorInstance,
  SensorProps,
  SensorOptions,
} from "@dnd-kit/core"
import { getEventCoordinates } from "@dnd-kit/utilities"

interface LongPressConstraint {
  delay: number
  tolerance: number
}

interface LongPressOptions extends SensorOptions {
  activationConstraint: LongPressConstraint
}

/**
 * カスタム TouchSensor: 長押し中に touchmove を preventDefault して
 * ブラウザのスクロール乗っ取りを防ぐ。
 *
 * dnd-kit 標準の TouchSensor は delay 待機中に preventDefault を呼ばないため、
 * モバイルブラウザがスクロールを開始し touchcancel が発火してドラッグが
 * 有効化されない問題がある。
 *
 * このセンサーは:
 * - 長押し待機中 (delay ms) は touchmove を preventDefault → スクロール抑制
 * - tolerance を超えて指が動いたら即キャンセル → 通常スクロールに戻る
 * - delay 経過後にドラッグを有効化
 */
export class LongPressTouchSensor implements SensorInstance {
  autoScrollEnabled = true

  private props: SensorProps<LongPressOptions>
  private initialCoordinates: { x: number; y: number }
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private activated = false
  private boundHandleMove: (e: TouchEvent) => void
  private boundHandleEnd: () => void
  private boundHandleCancel: () => void
  private boundHandleKeydown: (e: KeyboardEvent) => void
  private boundHandleContextMenu: (e: Event) => void

  constructor(props: SensorProps<LongPressOptions>) {
    this.props = props
    const { event } = props
    const coords = getEventCoordinates(event)
    this.initialCoordinates = coords ?? { x: 0, y: 0 }

    this.boundHandleMove = this.handleMove.bind(this)
    this.boundHandleEnd = this.handleEnd.bind(this)
    this.boundHandleCancel = this.handleCancel.bind(this)
    this.boundHandleKeydown = this.handleKeydown.bind(this)
    this.boundHandleContextMenu = (e: Event) => e.preventDefault()

    this.attach()
  }

  private attach() {
    const { delay } = this.props.options.activationConstraint

    // non-passive で touchmove をリッスン → preventDefault 可能にする
    document.addEventListener("touchmove", this.boundHandleMove, {
      passive: false,
      capture: false,
    })
    document.addEventListener("touchend", this.boundHandleEnd)
    document.addEventListener("touchcancel", this.boundHandleCancel)
    document.addEventListener("keydown", this.boundHandleKeydown)
    // 長押しのコンテキストメニューを抑制
    window.addEventListener("contextmenu", this.boundHandleContextMenu)

    // delay 後にドラッグ有効化
    this.timeoutId = setTimeout(() => {
      this.handleStart()
    }, delay)

    // pending 通知
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.props.onPending(
      this.props.active,
      this.props.options.activationConstraint as any,
      this.initialCoordinates
    )
  }

  private detach() {
    document.removeEventListener("touchmove", this.boundHandleMove)
    document.removeEventListener("touchend", this.boundHandleEnd)
    document.removeEventListener("touchcancel", this.boundHandleCancel)
    document.removeEventListener("keydown", this.boundHandleKeydown)
    window.removeEventListener("contextmenu", this.boundHandleContextMenu)

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private handleStart() {
    this.activated = true
    // 触覚フィードバック
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50)
    }
    this.props.onStart(this.initialCoordinates)
  }

  private handleMove(event: TouchEvent) {
    const touch = event.touches[0]
    if (!touch) return

    const coordinates = { x: touch.clientX, y: touch.clientY }
    const dx = coordinates.x - this.initialCoordinates.x
    const dy = coordinates.y - this.initialCoordinates.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (!this.activated) {
      const { tolerance } = this.props.options.activationConstraint

      if (distance > tolerance) {
        // tolerance 超過 → キャンセルしてスクロールに委ねる
        this.handleCancel()
        return
      }

      // tolerance 以内 → スクロールを防止して長押し待機を継続
      if (event.cancelable) {
        event.preventDefault()
      }
      return
    }

    // ドラッグ有効化後 → スクロールを防止して座標を通知
    if (event.cancelable) {
      event.preventDefault()
    }
    this.props.onMove(coordinates)
  }

  private handleEnd() {
    this.detach()
    if (!this.activated) {
      this.props.onAbort(this.props.active)
    }
    this.props.onEnd()
  }

  private handleCancel() {
    this.detach()
    if (this.activated) {
      // ドラッグ有効化後の touchcancel は正常終了として扱う
      // （ブラウザが長押し中に touchcancel を発火するケースへの対策）
      this.props.onEnd()
    } else {
      this.props.onAbort(this.props.active)
      this.props.onCancel()
    }
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.handleCancel()
    }
  }

  // --- 静的プロパティ: dnd-kit が使用 ---

  static activators: Activator<LongPressOptions>[] = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        event: React.SyntheticEvent,
        options: LongPressOptions,
      ) => {
        const { nativeEvent } = event as React.TouchEvent
        const { touches } = nativeEvent

        // マルチタッチは無視
        if (touches.length > 1) {
          return false
        }

        return true
      },
    },
  ]

  // iOS Safari 対応: グローバルに non-passive touchmove を登録
  static setup() {
    function noop() {}
    window.addEventListener("touchmove", noop, {
      capture: false,
      passive: false,
    })
    return function teardown() {
      window.removeEventListener("touchmove", noop)
    }
  }
}
