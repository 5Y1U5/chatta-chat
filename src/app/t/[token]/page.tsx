"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"

type Comment = {
  id: string
  content: string
  createdAt: string
  displayName: string | null
  avatarUrl: string | null
  isGuest: boolean
}

type GuestTaskData = {
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  assigneeName: string | null
  creatorName: string | null
  projectName: string | null
  projectColor: string | null
  comments: Comment[]
  shareLinkId: string
}

const statusLabel: Record<string, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
}

const priorityLabel: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
  none: "なし",
}

const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
  none: "bg-gray-100 text-gray-600",
}

const statusColor: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
}

export default function GuestTaskPage() {
  const { token } = useParams<{ token: string }>()
  const [task, setTask] = useState<GuestTaskData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [guestName, setGuestName] = useState("")
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // localStorage からゲスト名を復元
  useEffect(() => {
    const saved = localStorage.getItem("chatta-guest-name")
    if (saved) setGuestName(saved)
  }, [])

  // タスクデータ取得
  useEffect(() => {
    fetch(`/api/guest/tasks/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "invalid" : "error")
        return r.json()
      })
      .then((data) => {
        setTask(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(
          err.message === "invalid"
            ? "この共有リンクは無効または期限切れです。"
            : "読み込みに失敗しました。"
        )
        setLoading(false)
      })
  }, [token])

  // コメント投稿
  const handleSubmit = async () => {
    if (!comment.trim() || !guestName.trim() || !task) return
    setSubmitting(true)

    try {
      // ゲスト名を保存
      localStorage.setItem("chatta-guest-name", guestName.trim())

      const res = await fetch(`/api/guest/tasks/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          content: comment.trim(),
        }),
      })

      if (res.ok) {
        const newComment = await res.json()
        setTask((prev) =>
          prev ? { ...prev, comments: [...prev.comments, newComment] } : prev
        )
        setComment("")
        // コメント一覧末尾にスクロール
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">読み込み中...</div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">リンクが無効です</h1>
          <p className="text-gray-500">{error || "タスクが見つかりませんでした。"}</p>
        </div>
      </div>
    )
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-sm text-gray-700">ChattaChat</span>
          {task.projectName && (
            <span className="text-xs text-gray-400 ml-auto">
              {task.projectName}
            </span>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* タスク情報 */}
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
            <h1 className="text-xl font-bold text-gray-900 mb-3">{task.title}</h1>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[task.status] || "bg-gray-100"}`}>
                {statusLabel[task.status] || task.status}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColor[task.priority] || "bg-gray-100"}`}>
                優先度: {priorityLabel[task.priority] || task.priority}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.dueDate && (
                <div>
                  <span className="text-gray-400 text-xs">期日</span>
                  <p className="text-gray-700">{formatDate(task.dueDate)}</p>
                </div>
              )}
              {task.assigneeName && (
                <div>
                  <span className="text-gray-400 text-xs">担当</span>
                  <p className="text-gray-700">{task.assigneeName}</p>
                </div>
              )}
              {task.creatorName && (
                <div>
                  <span className="text-gray-400 text-xs">作成者</span>
                  <p className="text-gray-700">{task.creatorName}</p>
                </div>
              )}
            </div>

            {task.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
          </div>

          {/* コメント一覧 */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              コメント ({task.comments.length})
            </h2>

            {task.comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">まだコメントはありません</p>
            ) : (
              <div className="space-y-4">
                {task.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium ${
                      c.isGuest ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary"
                    }`}>
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        c.displayName?.charAt(0) || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {c.displayName || "名無し"}
                        </span>
                        {c.isGuest && (
                          <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">ゲスト</span>
                        )}
                        <span className="text-[11px] text-gray-400">{formatTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}

            {/* コメント入力 */}
            <div className="mt-6 pt-4 border-t">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="お名前"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="コメントを入力..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && !submitting) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!comment.trim() || !guestName.trim() || submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {submitting ? "送信中..." : "送信"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs text-gray-400">Powered by ChattaChat</p>
        </div>
      </footer>
    </div>
  )
}
