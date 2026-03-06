"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  channelId: string
}

// 音声録音 → 議事録生成の基盤コンポーネント
// 注意: 文字起こしには外部 API（Whisper 等）が必要。現在は録音とアップロードまで対応
export function VoiceRecorder({ channelId }: Props) {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    setError(null)
    setAudioUrl(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        // ファイルとしてアップロード
        setProcessing(true)
        try {
          const formData = new FormData()
          const ext = mediaRecorder.mimeType.includes("webm") ? "webm" : "mp4"
          formData.append("file", blob, `recording-${Date.now()}.${ext}`)

          const res = await fetch("/api/internal/upload", {
            method: "POST",
            body: formData,
          })
          const data = await res.json()

          if (data.error) {
            setError("録音ファイルのアップロードに失敗しました")
          }
          // TODO: data.fileUrl を Whisper API に送って文字起こし → 議事録生成
        } catch {
          setError("アップロードに失敗しました")
        } finally {
          setProcessing(false)
        }
      }

      mediaRecorder.start(1000) // 1秒ごとにチャンク
      setRecording(true)
    } catch {
      setError("マイクへのアクセスが許可されていません")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={startRecording}
          disabled={processing}
          title="録音開始"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-600 animate-pulse"
          onClick={stopRecording}
          title="録音停止"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </Button>
      )}
      {processing && <span className="text-xs text-muted-foreground">処理中...</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
