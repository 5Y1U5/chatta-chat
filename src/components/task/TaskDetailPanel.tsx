"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { RECURRENCE_PRESETS, presetToRRule, rruleToText, type RecurrencePreset } from "@/lib/recurrence"
import type { TaskInfo, TaskCommentInfo } from "@/types/chat"

type Props = {
  task: TaskInfo
  projects: { id: string; name: string; color: string | null }[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  workspaceId: string
  currentUserId: string
  onClose: () => void
  onUpdate: () => Promise<void>
}

export function TaskDetailPanel({
  task,
  projects,
  members,
  workspaceId,
  currentUserId,
  onClose,
  onUpdate,
}: Props) {
  const router = useRouter()
  const [description, setDescription] = useState(task.description || "")
  const [descriptionDirty, setDescriptionDirty] = useState(false)
  const [subTasks, setSubTasks] = useState<TaskInfo[]>([])
  const [comments, setComments] = useState<TaskCommentInfo[]>([])
  const [newComment, setNewComment] = useState("")
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("")
  const [saving, setSaving] = useState(false)

  // タスクが切り替わった時にリセット
  useEffect(() => {
    setDescription(task.description || "")
    setDescriptionDirty(false)
  }, [task.id, task.description])

  // サブタスクとコメントを取得
  const fetchDetails = useCallback(async () => {
    const [subRes, commentRes] = await Promise.all([
      fetch(`/api/internal/tasks?parentTaskId=${task.id}`),
      fetch(`/api/internal/tasks/comments?taskId=${task.id}`),
    ])
    if (subRes.ok) setSubTasks(await subRes.json())
    if (commentRes.ok) setComments(await commentRes.json())
  }, [task.id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const handleUpdate = async (field: string, value: unknown) => {
    setSaving(true)
    await fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, [field]: value }),
    })
    await onUpdate()
    setSaving(false)
    router.refresh()
  }

  const handleSaveDescription = async () => {
    await handleUpdate("description", description)
    setDescriptionDirty(false)
  }

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) return
    await fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newSubTaskTitle.trim(),
        parentTaskId: task.id,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
      }),
    })
    setNewSubTaskTitle("")
    await fetchDetails()
    await onUpdate()
  }

  const handleSubTaskStatusChange = async (subTaskId: string, status: string) => {
    await fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: subTaskId, status }),
    })
    await fetchDetails()
    router.refresh()
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    await fetch("/api/internal/tasks/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, content: newComment.trim() }),
    })
    setNewComment("")
    await fetchDetails()
  }

  const handleDelete = async () => {
    if (!confirm("このタスクを削除しますか？")) return
    await fetch(`/api/internal/tasks?taskId=${task.id}`, { method: "DELETE" })
    onClose()
    await onUpdate()
    router.refresh()
  }

  return (
    <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden lg:w-96">
      {/* ヘッダー */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold truncate">{task.title}</span>
        <div className="flex items-center gap-1">
          {saving && <span className="text-xs text-muted-foreground">保存中...</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ステータス */}
        <Field label="ステータス">
          <Select value={task.status} onValueChange={(v) => handleUpdate("status", v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">未着手</SelectItem>
              <SelectItem value="in_progress">進行中</SelectItem>
              <SelectItem value="done">完了</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* 担当者 */}
        <Field label="担当者">
          <Select
            value={task.assigneeId || "_none"}
            onValueChange={(v) => handleUpdate("assigneeId", v === "_none" ? null : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="未割当" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">未割当</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.displayName || m.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* 期日 */}
        <Field label="期日">
          <Input
            type="date"
            className="h-8 text-sm"
            value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
            onChange={(e) => handleUpdate("dueDate", e.target.value || null)}
          />
        </Field>

        {/* 優先度 */}
        <Field label="優先度">
          <Select value={task.priority} onValueChange={(v) => handleUpdate("priority", v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">高</SelectItem>
              <SelectItem value="medium">中</SelectItem>
              <SelectItem value="low">低</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* プロジェクト */}
        <Field label="プロジェクト">
          <Select
            value={task.projectId || "_none"}
            onValueChange={(v) => handleUpdate("projectId", v === "_none" ? null : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="なし" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">なし</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    {p.color && (
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    )}
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* 繰り返し */}
        <Field label={`繰り返し${task.recurrenceRule ? ` (${rruleToText(task.recurrenceRule)})` : ""}`}>
          <Select
            value={task.recurrenceRule ? "_current" : "none"}
            onValueChange={(v) => {
              if (v === "_current") return
              const preset = v as RecurrencePreset
              const rule = presetToRRule(preset, task.dueDate ? new Date(task.dueDate) : undefined)
              handleUpdate("recurrenceRule", rule)
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                {task.recurrenceRule ? rruleToText(task.recurrenceRule) : "繰り返しなし"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RECURRENCE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* 説明 */}
        <Field label="説明">
          <Textarea
            className="text-sm min-h-20 resize-none"
            placeholder="タスクの説明を入力..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setDescriptionDirty(true)
            }}
            onBlur={() => descriptionDirty && handleSaveDescription()}
          />
          {descriptionDirty && (
            <Button size="sm" variant="outline" className="mt-1" onClick={handleSaveDescription}>
              保存
            </Button>
          )}
        </Field>

        {/* サブタスク */}
        <Field label={`サブタスク (${subTasks.length})`}>
          <div className="space-y-1">
            {subTasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleSubTaskStatusChange(
                      st.id,
                      st.status === "done" ? "todo" : "done"
                    )
                  }
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    st.status === "done"
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-muted-foreground/40 hover:border-green-500"
                  )}
                >
                  {st.status === "done" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={cn("text-sm truncate", st.status === "done" && "line-through text-muted-foreground")}>
                  {st.title}
                </span>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <Input
                className="h-7 text-sm"
                placeholder="サブタスクを追加..."
                value={newSubTaskTitle}
                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubTask()}
              />
              <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={handleAddSubTask}>
                追加
              </Button>
            </div>
          </div>
        </Field>

        {/* コメント（タスク内チャット） */}
        <Field label={`コメント (${comments.length})`}>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-xs">
                    {c.user.displayName || "不明"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("ja-JP", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="コメントを入力..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleAddComment}>
                送信
              </Button>
            </div>
          </div>
        </Field>

        {/* 削除 */}
        <div className="pt-4 border-t">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            タスクを削除
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  )
}
