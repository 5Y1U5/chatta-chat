"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChannelMemberInfo } from "@/types/chat"

type Props = {
  channelId: string
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  members?: ChannelMemberInfo[]
}

export function MessageInput({ onSend, disabled, placeholder, members }: Props) {
  const [content, setContent] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // メンション候補リスト
  const mentionCandidates = getMentionCandidates(mentionQuery, members || [])

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return

    onSend(trimmed)
    setContent("")
    setShowMentions(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [content, onSend])

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

  // クリック外でメンション候補を閉じる
  useEffect(() => {
    if (!showMentions) return
    function handleClick() {
      setShowMentions(false)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [showMentions])

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

      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "メッセージを入力... (@AI でAIに質問)"}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          size="icon"
          className="shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
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
