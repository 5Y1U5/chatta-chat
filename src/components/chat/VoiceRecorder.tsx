"use client"

import { useState, useRef, useCallback, useEffect } from "react"
type Props = {
  onTranscript?: (text: string) => void
  size?: "default" | "large"
}

// Web Speech API の型定義
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

export function VoiceRecorder({ onTranscript, size = "default" }: Props) {
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState("")
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 録音時間のタイマー
  useEffect(() => {
    if (listening) {
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [listening])

  const startListening = useCallback(() => {
    setError(null)
    setInterimText("")

    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("このブラウザは音声入力に対応していません")
      return
    }

    const recognition = new (SpeechRecognition as new () => SpeechRecognitionInstance)()
    recognition.lang = "ja-JP"
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ""
      let final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final && onTranscript) {
        onTranscript(final)
        setInterimText("")
      } else {
        setInterimText(interim)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        setError("マイクへのアクセスが許可されていません")
      } else if (e.error === "no-speech") {
        // 無視
      } else {
        setError("音声認識エラーが発生しました")
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      setInterimText("")
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setListening(false)
    setInterimText("")
  }, [])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, "0")}`
  }

  return (
    <>
      {/* マイクボタン */}
      {!listening ? (
        size === "large" ? (
          <button
            title="タップして話す"
            onClick={startListening}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            タップして話す
          </button>
        ) : (
          <button
            title="音声入力"
            onClick={startListening}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        )
      ) : (
        <button
          title="音声入力を停止"
          onClick={stopListening}
          className={`flex items-center justify-center rounded-full bg-red-500 text-white shadow-sm shadow-red-500/30 transition-all ${size === "large" ? "h-10 w-10" : "h-8 w-8"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      )}

      {/* 録音中バー（入力欄の上に表示） */}
      {listening && (
        <div className="absolute bottom-full left-0 right-0 mb-0 px-4 pb-2">
          <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
            {/* パルスドット */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>

            {/* 波形アニメーション */}
            <div className="flex items-center gap-[3px] h-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-red-500"
                  style={{
                    animation: `voice-wave 1s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* 認識中テキスト or ステータス */}
            <div className="flex-1 min-w-0">
              {interimText ? (
                <p className="text-sm truncate text-foreground">{interimText}</p>
              ) : (
                <p className="text-sm text-muted-foreground">音声を聞いています...</p>
              )}
            </div>

            {/* 録音時間 */}
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {formatDuration(duration)}
            </span>

            {/* 停止ボタン */}
            <button
              onClick={stopListening}
              className="flex h-7 items-center gap-1 rounded-md bg-red-500 px-2.5 text-xs font-medium text-white hover:bg-red-600 transition-colors shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              停止
            </button>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && !listening && (
        <span className="text-xs text-destructive ml-1">{error}</span>
      )}

      {/* 波形アニメーション用CSS */}
      {listening && (
        <style>{`
          @keyframes voice-wave {
            0%, 100% { height: 4px; }
            50% { height: 16px; }
          }
        `}</style>
      )}
    </>
  )
}
