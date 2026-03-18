"use client"

import { useState, useRef, useCallback } from "react"

type Props = {
  onTranscript?: (text: string) => void
}

// Web Speech API の型定義
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

// 音声入力コンポーネント（Web Speech API ベース）
export function VoiceRecorder({ onTranscript }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<unknown>(null)

  const startListening = useCallback(() => {
    setError(null)

    // Web Speech API のサポートチェック
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("このブラウザは音声入力に対応していません")
      return
    }

    const recognition = new (SpeechRecognition as new () => {
      lang: string
      interimResults: boolean
      continuous: boolean
      start: () => void
      stop: () => void
      onresult: ((e: SpeechRecognitionEvent) => void) | null
      onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
      onend: (() => void) | null
    })()
    recognition.lang = "ja-JP"
    recognition.interimResults = false
    recognition.continuous = true

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const results = e.results
      let transcript = ""
      for (let i = e.resultIndex; i < results.length; i++) {
        if (results[i].isFinal) {
          transcript += results[i][0].transcript
        }
      }
      if (transcript && onTranscript) {
        onTranscript(transcript)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        setError("マイクへのアクセスが許可されていません")
      } else if (e.error === "no-speech") {
        // 無視（音声が検出されなかった）
      } else {
        setError("音声認識エラーが発生しました")
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current as { stop: () => void } | null
    if (recognition) {
      recognition.stop()
    }
    setListening(false)
  }, [])

  return (
    <div className="flex items-center">
      {!listening ? (
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
      ) : (
        <button
          title="音声入力を停止"
          onClick={stopListening}
          className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 animate-pulse transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      )}
      {error && (
        <span className="text-xs text-destructive ml-1">{error}</span>
      )}
    </div>
  )
}
