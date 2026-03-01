"use client"

import { useState } from "react"

const EMOJI_CATEGORIES = [
  {
    label: "よく使う",
    emojis: ["👍", "❤️", "😂", "🎉", "👀", "🙏", "🔥", "✅"],
  },
  {
    label: "顔",
    emojis: ["😊", "😄", "🤔", "😅", "😢", "😮", "🥳", "😎"],
  },
  {
    label: "ジェスチャー",
    emojis: ["👏", "🙌", "💪", "✌️", "🤝", "👋", "☝️", "👌"],
  },
  {
    label: "記号",
    emojis: ["⭐", "💯", "❌", "⚡", "💡", "📌", "🚀", "🏆"],
  },
]

type Props = {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState(0)

  return (
    <div
      className="absolute bottom-full right-0 mb-1 w-64 rounded-lg border bg-background shadow-lg z-50"
      onMouseLeave={onClose}
    >
      {/* カテゴリータブ */}
      <div className="flex border-b px-1 pt-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(i)}
            className={`flex-1 rounded-t px-1 py-1 text-xs ${
              activeCategory === i
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 絵文字グリッド */}
      <div className="grid grid-cols-8 gap-0.5 p-2">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
