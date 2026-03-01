"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChannelMemberInfo } from "@/types/chat"

export type FileAttachment = {
  fileUrl: string
  fileName: string
  fileType: string
}

type Props = {
  channelId: string
  onSend: (content: string, file?: FileAttachment) => void
  disabled?: boolean
  placeholder?: string
  members?: ChannelMemberInfo[]
  onTyping?: () => void
}

export function MessageInput({ channelId, onSend, disabled, placeholder, members, onTyping }: Props) {
  const [content, setContent] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionIndex, setMentionIndex] = useState(0)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // メンション候補リスト
  const mentionCandidates = getMentionCandidates(mentionQuery, members || [])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed && !pendingFile) return

    let fileAttachment: FileAttachment | undefined

    // ファイルがある場合はアップロード
    if (pendingFile) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", pendingFile)

        const res = await fetch("/api/internal/upload", {
          method: "POST",
          body: formData,
        })
        const data = await res.json()

        if (data.error) {
          console.error("アップロードエラー:", data.error)
          setUploading(false)
          return
        }

        fileAttachment = {
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
        }
      } catch (error) {
        console.error("アップロードエラー:", error)
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }
    }

    onSend(trimmed, fileAttachment)
    setContent("")
    setPendingFile(null)
    setShowMentions(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [content, pendingFile, onSend])

  function handleKeyDown(e: React.KeyboardEvent) {
    // メンション候補表示中のキー操作
    if (showMentions && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(mentionCandidates[mentionIndex])
        return
      }
      if (e.key === "Escape") {
        setShowMentions(false)
        return
      }
    }

    // Enter で送信、Shift+Enter で改行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)

    // タイピング通知
    if (value.trim() && onTyping) onTyping()

    // @ の後のテキストを検出
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowMentions(true)
      setMentionIndex(0)
    } else {
      setShowMentions(false)
    }
  }

  function insertMention(candidate: { label: string; value: string }) {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = content.substring(0, cursorPos)
    const textAfterCursor = content.substring(cursorPos)

    // @ の位置を見つけて置換
    const atIndex = textBeforeCursor.lastIndexOf("@")
    if (atIndex >= 0) {
      const newContent = textBeforeCursor.substring(0, atIndex) + candidate.value + " " + textAfterCursor
      setContent(newContent)
    }

    setShowMentions(false)

    // フォーカスを戻す
    requestAnimationFrame(() => {
      textarea.focus()
    })
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("ファイルサイズは10MB以下にしてください")
        return
      }
      setPendingFile(file)
    }
    // input をリセット（同じファイルを再選択可能に）
    e.target.value = ""
  }

  // クリック外でメンション候補を閉じる
  useEffect(() => {
    if (!showMentions) return
    function handleClick() {
      setShowMentions(false)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [showMentions])

  const isImage = pendingFile?.type.startsWith("image/")

  return (
    <div className="relative border-t p-4">
      {/* メンション候補ポップアップ */}
      {showMentions && mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 max-h-48 overflow-y-auto rounded-lg border bg-background shadow-lg z-50">
          {mentionCandidates.map((candidate, i) => (
            <button
              key={candidate.value}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                i === mentionIndex ? "bg-muted" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(candidate)
              }}
            >
              {candidate.isAi ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  AI
                </span>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {candidate.label.charAt(0).toUpperCase()}
                </span>
              )}
              <span>{candidate.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ファイルプレビュー */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          {isImage ? (
            <img
              src={URL.createObjectURL(pendingFile)}
              alt={pendingFile.name}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
          <span className="flex-1 truncate text-sm">{pendingFile.name}</span>
          <button
            onClick={() => setPendingFile(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {/* ファイル添付ボタン */}
        <button
          title="ファイルを添付"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
        />

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "メッセージを入力... (@AI でAIに質問)"}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled || uploading}
        />
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && !pendingFile) || disabled || uploading}
          size="icon"
          className="shrink-0"
        >
          {uploading ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  )
}

type MentionCandidate = {
  label: string
  value: string
  isAi: boolean
}

function getMentionCandidates(
  query: string,
  members: ChannelMemberInfo[]
): MentionCandidate[] {
  const q = query.toLowerCase()
  const candidates: MentionCandidate[] = []

  // @AI は常に候補に含める
  if ("ai".startsWith(q) || q === "") {
    candidates.push({ label: "AI アシスタント", value: "@AI", isAi: true })
  }

  // メンバー候補
  for (const m of members) {
    const name = m.displayName || ""
    if (name.toLowerCase().includes(q) || q === "") {
      candidates.push({ label: name, value: `@${name}`, isAi: false })
    }
  }

  return candidates.slice(0, 8) // 最大8件
}
