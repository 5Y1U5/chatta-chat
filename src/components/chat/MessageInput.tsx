"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SummarizeDialog } from "@/components/chat/SummarizeDialog"
import { MinutesDialog } from "@/components/chat/MinutesDialog"
import { MemoryPanel } from "@/components/chat/MemoryPanel"
import { VoiceRecorder } from "@/components/chat/VoiceRecorder"
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
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  // ダイアログの開閉状態（Popover外で管理）
  const [summarizeOpen, setSummarizeOpen] = useState(false)
  const [minutesOpen, setMinutesOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // メンション候補リスト
  const mentionCandidates = getMentionCandidates(mentionQuery, members || [])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed && !pendingFile) return

    let fileAttachment: FileAttachment | undefined

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

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)

    if (value.trim() && onTyping) onTyping()

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

    const atIndex = textBeforeCursor.lastIndexOf("@")
    if (atIndex >= 0) {
      const newContent = textBeforeCursor.substring(0, atIndex) + candidate.value + " " + textAfterCursor
      setContent(newContent)
    }

    setShowMentions(false)
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
    e.target.value = ""
  }

  useEffect(() => {
    if (!showMentions) return
    function handleClick() {
      setShowMentions(false)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [showMentions])

  async function handleAiSuggest() {
    setLoadingSuggestions(true)
    setAiSuggestions([])
    try {
      const res = await fetch("/api/internal/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSuggestions(data.suggestions || [])
      }
    } catch {
      // エラーは静かに無視
    } finally {
      setLoadingSuggestions(false)
    }
  }

  function selectSuggestion(text: string) {
    setContent(text)
    setAiSuggestions([])
    textareaRef.current?.focus()
  }

  // 音声入力の結果をテキストエリアに追加
  const handleVoiceTranscript = useCallback((text: string) => {
    setContent((prev) => prev + text)
    textareaRef.current?.focus()
  }, [])

  const isImage = pendingFile?.type.startsWith("image/")

  return (
    <div className="relative shrink-0 px-4 pb-4 pt-2">
      {/* AI 返信候補 */}
      {aiSuggestions.length > 0 && (
        <div className="mb-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">AI が提案する返信:</span>
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setAiSuggestions([])}
            >
              閉じる
            </button>
          </div>
          {aiSuggestions.map((s, i) => (
            <button
              key={i}
              className="w-full rounded-md border bg-muted/30 px-3 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors"
              onClick={() => selectSuggestion(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

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

      <div className="mx-auto max-w-3xl rounded-2xl border bg-background focus-within:ring-1 focus-within:ring-ring/30 transition-shadow">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "メッセージを入力... (@AI でAIに質問)"}
          className="min-h-[40px] max-h-[120px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
          disabled={disabled || uploading}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            {/* ＋ AIツールメニュー */}
            <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
              <PopoverTrigger asChild>
                <button
                  title="ツール"
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-52 p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => { setToolsOpen(false); setSummarizeOpen(true) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  会話を要約
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => { setToolsOpen(false); setMinutesOpen(true) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="M9 14h6" /><path d="M9 18h6" /><path d="M9 10h6" />
                  </svg>
                  議事録を作成
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => { setToolsOpen(false); setMemoryOpen(true) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  重要事項メモリ
                </button>
              </PopoverContent>
            </Popover>

            {/* ファイル添付ボタン */}
            <button
              title="ファイルを添付"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* 音声入力 */}
            <VoiceRecorder onTranscript={handleVoiceTranscript} />

            {/* AI 返信提案ボタン */}
            <button
              title="AIで返信を作成"
              onClick={handleAiSuggest}
              disabled={disabled || loadingSuggestions}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {loadingSuggestions ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
              )}
            </button>
          </div>

          <Button
            onClick={handleSend}
            disabled={(!content.trim() && !pendingFile) || disabled || uploading}
            size="icon"
            className="h-8 w-8 rounded-full"
          >
            {uploading ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* ダイアログ（Popoverの外で管理） */}
      <SummarizeDialog channelId={channelId} open={summarizeOpen} onOpenChange={setSummarizeOpen} />
      <MinutesDialog channelId={channelId} open={minutesOpen} onOpenChange={setMinutesOpen} />
      <MemoryPanel channelId={channelId} open={memoryOpen} onOpenChange={setMemoryOpen} />
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

  if ("ai".startsWith(q) || q === "") {
    candidates.push({ label: "AI アシスタント", value: "@AI", isAi: true })
  }

  for (const m of members) {
    const name = m.displayName || ""
    if (name.toLowerCase().includes(q) || q === "") {
      candidates.push({ label: name, value: `@${name}`, isAi: false })
    }
  }

  return candidates.slice(0, 8)
}
