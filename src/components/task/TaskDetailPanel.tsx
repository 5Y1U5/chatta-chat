"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { RECURRENCE_PRESETS, presetToRRule, rruleToText, type RecurrencePreset } from "@/lib/recurrence"
import type { TaskInfo, TaskCommentInfo } from "@/types/chat"

type MemberInfo = { id: string; userId: string; displayName: string | null; avatarUrl: string | null }

type Props = {
  task: TaskInfo
  projects: { id: string; name: string; color: string | null }[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  workspaceId: string
  currentUserId: string
  onClose: () => void
  onOptimisticUpdate: (taskId: string, updates: Partial<TaskInfo>) => void
  onTaskDeleted: (taskId: string) => void
}

function parseDateStr(dateStr: string): Date {
  const p = dateStr.slice(0, 10).split("-")
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}

function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function TaskDetailPanel({
  task,
  projects,
  members,
  workspaceId,
  currentUserId,
  onClose,
  onOptimisticUpdate,
  onTaskDeleted,
}: Props) {
  const [title, setTitle] = useState(task.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const [description, setDescription] = useState(task.description || "")
  const [descriptionDirty, setDescriptionDirty] = useState(false)
  const [subTasks, setSubTasks] = useState<TaskInfo[]>([])
  const [comments, setComments] = useState<TaskCommentInfo[]>([])
  const [taskMembers, setTaskMembers] = useState<MemberInfo[]>([])
  const [newComment, setNewComment] = useState("")
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("")
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  // ネストサブタスク展開状態
  const [expandedSubTasks, setExpandedSubTasks] = useState<Set<string>>(new Set())
  const [nestedSubTasks, setNestedSubTasks] = useState<Record<string, TaskInfo[]>>({})
  const [newNestedTitle, setNewNestedTitle] = useState<Record<string, string>>({})

  // タスクが切り替わった時にリセット
  useEffect(() => {
    setTitle(task.title)
    setEditingTitle(false)
    setDescription(task.description || "")
    setDescriptionDirty(false)
    setExpandedSubTasks(new Set())
    setNestedSubTasks({})
  }, [task.id, task.title, task.description])

  // サブタスク、コメント、メンバーをバックグラウンドで取得
  const fetchDetails = useCallback(async () => {
    const [subRes, commentRes, memberRes] = await Promise.all([
      fetch(`/api/internal/tasks?parentTaskId=${task.id}`),
      fetch(`/api/internal/tasks/comments?taskId=${task.id}`),
      fetch(`/api/internal/tasks/members?taskId=${task.id}`),
    ])
    if (subRes.ok) setSubTasks(await subRes.json())
    if (commentRes.ok) setComments(await commentRes.json())
    if (memberRes.ok) setTaskMembers(await memberRes.json())
    setDetailsLoaded(true)
  }, [task.id])

  useEffect(() => {
    setSubTasks([])
    setComments([])
    setTaskMembers([])
    setDetailsLoaded(false)
    setNewComment("")
    setNewSubTaskTitle("")
  }, [task.id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // タイトル編集開始時にフォーカス
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // ネストサブタスクの取得
  const fetchNestedSubTasks = async (parentId: string) => {
    const res = await fetch(`/api/internal/tasks?parentTaskId=${parentId}`)
    if (res.ok) {
      const data = await res.json()
      setNestedSubTasks((prev) => ({ ...prev, [parentId]: data }))
    }
  }

  const toggleSubTaskExpand = (subTaskId: string) => {
    setExpandedSubTasks((prev) => {
      const next = new Set(prev)
      if (next.has(subTaskId)) {
        next.delete(subTaskId)
      } else {
        next.add(subTaskId)
        if (!nestedSubTasks[subTaskId]) {
          fetchNestedSubTasks(subTaskId)
        }
      }
      return next
    })
  }

  // 楽観的フィールド更新
  const handleUpdate = (field: string, value: unknown) => {
    const optimistic: Partial<TaskInfo> = { [field]: value }

    if (field === "status") {
      optimistic.completedAt = value === "done" ? new Date().toISOString() : null
    }
    if (field === "assigneeId") {
      const member = members.find((m) => m.id === value)
      optimistic.assignee = member
        ? { id: member.id, displayName: member.displayName, avatarUrl: member.avatarUrl }
        : null
    }
    if (field === "projectId") {
      const project = projects.find((p) => p.id === value)
      optimistic.project = project
        ? { id: project.id, name: project.name, color: project.color }
        : null
    }

    onOptimisticUpdate(task.id, optimistic)

    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, [field]: value }),
    })
  }

  const handleSaveTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      handleUpdate("title", trimmed)
    } else {
      setTitle(task.title)
    }
    setEditingTitle(false)
  }

  const handleSaveDescription = () => {
    handleUpdate("description", description)
    setDescriptionDirty(false)
  }

  // 楽観的サブタスク追加
  const handleAddSubTask = () => {
    if (!newSubTaskTitle.trim()) return
    if (subTasks.length >= 15) return

    const tempId = crypto.randomUUID()
    const tempSubTask: TaskInfo = {
      id: tempId,
      workspaceId,
      projectId: task.projectId,
      parentTaskId: task.id,
      title: newSubTaskTitle.trim(),
      description: null,
      status: "todo",
      priority: "medium",
      assigneeId: task.assigneeId,
      creatorId: currentUserId,
      dueDate: null,
      completedAt: null,
      recurrenceRule: null,
      sortOrder: subTasks.length,
      fileUrl: null,
      fileName: null,
      fileType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignee: task.assignee,
      creator: members.find((m) => m.id === currentUserId) || { id: currentUserId, displayName: null, avatarUrl: null },
      project: task.project,
      _count: { subTasks: 0, comments: 0 },
    }

    setSubTasks((prev) => [...prev, tempSubTask])
    onOptimisticUpdate(task.id, {
      _count: { subTasks: subTasks.length + 1, comments: task._count?.comments || 0 },
    })
    const t = newSubTaskTitle.trim()
    setNewSubTaskTitle("")

    fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        parentTaskId: task.id,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
      }),
    }).then(async (res) => {
      if (res.ok) {
        const realTask = await res.json()
        setSubTasks((prev) => prev.map((st) => (st.id === tempId ? realTask : st)))
      }
    })
  }

  // 楽観的ネストサブタスク追加
  const handleAddNestedSubTask = (parentSubTaskId: string) => {
    const ntitle = newNestedTitle[parentSubTaskId]?.trim()
    if (!ntitle) return
    const current = nestedSubTasks[parentSubTaskId] || []
    if (current.length >= 15) return

    const tempId = crypto.randomUUID()
    const tempTask: TaskInfo = {
      id: tempId,
      workspaceId,
      projectId: task.projectId,
      parentTaskId: parentSubTaskId,
      title: ntitle,
      description: null,
      status: "todo",
      priority: "medium",
      assigneeId: task.assigneeId,
      creatorId: currentUserId,
      dueDate: null,
      completedAt: null,
      recurrenceRule: null,
      sortOrder: current.length,
      fileUrl: null,
      fileName: null,
      fileType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignee: task.assignee,
      creator: members.find((m) => m.id === currentUserId) || { id: currentUserId, displayName: null, avatarUrl: null },
      project: task.project,
      _count: { subTasks: 0, comments: 0 },
    }

    setNestedSubTasks((prev) => ({
      ...prev,
      [parentSubTaskId]: [...(prev[parentSubTaskId] || []), tempTask],
    }))
    setNewNestedTitle((prev) => ({ ...prev, [parentSubTaskId]: "" }))

    fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ntitle,
        parentTaskId: parentSubTaskId,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
      }),
    }).then(async (res) => {
      if (res.ok) {
        const realTask = await res.json()
        setNestedSubTasks((prev) => ({
          ...prev,
          [parentSubTaskId]: (prev[parentSubTaskId] || []).map((t) =>
            t.id === tempId ? realTask : t
          ),
        }))
      }
    })
  }

  // 楽観的サブタスクステータス変更
  const handleSubTaskStatusChange = (subTaskId: string, status: string) => {
    setSubTasks((prev) =>
      prev.map((t) =>
        t.id === subTaskId
          ? { ...t, status, completedAt: status === "done" ? new Date().toISOString() : null }
          : t
      )
    )
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: subTaskId, status }),
    })
  }

  // 楽観的ネストサブタスクステータス変更
  const handleNestedSubTaskStatusChange = (parentId: string, subTaskId: string, status: string) => {
    setNestedSubTasks((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] || []).map((t) =>
        t.id === subTaskId
          ? { ...t, status, completedAt: status === "done" ? new Date().toISOString() : null }
          : t
      ),
    }))
    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: subTaskId, status }),
    })
  }

  // 楽観的メンバー追加
  const handleAddMember = (userId: string) => {
    const member = members.find((m) => m.id === userId)
    if (member) {
      setTaskMembers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), userId, displayName: member.displayName, avatarUrl: member.avatarUrl },
      ])
    }
    fetch("/api/internal/tasks/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, userId }),
    })
  }

  const handleRemoveMember = (userId: string) => {
    setTaskMembers((prev) => prev.filter((m) => m.userId !== userId))
    fetch(`/api/internal/tasks/members?taskId=${task.id}&userId=${userId}`, { method: "DELETE" })
  }

  // 楽観的コメント追加
  const handleAddComment = () => {
    if (!newComment.trim()) return

    const currentMember = members.find((m) => m.id === currentUserId)
    const tempComment: TaskCommentInfo = {
      id: crypto.randomUUID(),
      taskId: task.id,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      user: {
        id: currentUserId,
        displayName: currentMember?.displayName || null,
        avatarUrl: currentMember?.avatarUrl || null,
      },
    }

    setComments((prev) => [...prev, tempComment])
    onOptimisticUpdate(task.id, {
      _count: { subTasks: task._count?.subTasks || 0, comments: (task._count?.comments || 0) + 1 },
    })
    const content = newComment.trim()
    setNewComment("")

    fetch("/api/internal/tasks/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, content }),
    })
  }

  const handleDelete = () => {
    if (!confirm("このタスクを削除しますか？")) return
    onTaskDeleted(task.id)
    fetch(`/api/internal/tasks?taskId=${task.id}`, { method: "DELETE" })
  }

  // メンバー追加候補
  const memberIds = new Set(taskMembers.map((m) => m.userId))
  const availableMembers = members.filter((m) => !memberIds.has(m.id))

  const completedSubTasks = subTasks.filter((t) => t.status === "done").length
  const subTaskProgress = subTasks.length > 0 ? (completedSubTasks / subTasks.length) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:static md:inset-auto md:z-auto md:w-96 md:shrink-0 md:border-l lg:w-[28rem] animate-in slide-in-from-right-5 duration-200 overflow-hidden">
      {/* ヘッダー: 閉じる・完了ボタン・アクション */}
      <div className="shrink-0 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted text-muted-foreground touch-manipulation"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <Button
              size="sm"
              variant={task.status === "done" ? "outline" : "default"}
              className={cn(
                "h-7 text-xs",
                task.status === "done" && "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
              )}
              onClick={() => handleUpdate("status", task.status === "done" ? "todo" : "done")}
            >
              {task.status === "done" ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  完了済み
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  完了にする
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title="リンクをコピー"
              onClick={async () => {
                const url = `${window.location.origin}/${workspaceId}/tasks?taskId=${task.id}`
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
                  // フォールバック
                  const textarea = document.createElement("textarea")
                  textarea.value = url
                  document.body.appendChild(textarea)
                  textarea.select()
                  document.execCommand("copy")
                  document.body.removeChild(textarea)
                }
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
            >
              {linkCopied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-40 p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={handleDelete}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  タスクを削除
                </button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="hidden md:flex h-7 w-7" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* タイトル（編集可能） */}
        <div className="px-4 pt-4 pb-2">
          {editingTitle ? (
            <textarea
              ref={titleInputRef}
              className="w-full text-lg font-bold resize-none border-0 bg-transparent outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1"
              value={title}
              rows={Math.min(Math.ceil(title.length / 30) || 1, 3)}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleSaveTitle() }
                if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false) }
              }}
            />
          ) : (
            <h2
              className="text-lg font-bold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {task.title}
            </h2>
          )}
        </div>

        {/* プロパティ: 2列グリッド */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {/* ステータス */}
            <PropField label="ステータス">
              <Select value={task.status} onValueChange={(v) => handleUpdate("status", v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">未着手</SelectItem>
                  <SelectItem value="in_progress">進行中</SelectItem>
                  <SelectItem value="done">完了</SelectItem>
                </SelectContent>
              </Select>
            </PropField>

            {/* 優先度 */}
            <PropField label="優先度">
              <Select value={task.priority} onValueChange={(v) => handleUpdate("priority", v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </PropField>

            {/* 担当者 */}
            <PropField label="担当者">
              <Select
                value={task.assigneeId || "_none"}
                onValueChange={(v) => handleUpdate("assigneeId", v === "_none" ? null : v)}
              >
                <SelectTrigger className="h-7 text-xs">
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
            </PropField>

            {/* 期日 */}
            <PropField label="期日">
              <DatePicker
                value={task.dueDate ? parseDateStr(task.dueDate) : undefined}
                onChange={(date) => handleUpdate("dueDate", date ? formatDateLocal(date) : null)}
                className="w-full h-7 text-xs"
              />
            </PropField>

            {/* プロジェクト */}
            <PropField label="プロジェクト">
              <Select
                value={task.projectId || "_none"}
                onValueChange={(v) => handleUpdate("projectId", v === "_none" ? null : v)}
              >
                <SelectTrigger className="h-7 text-xs">
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
            </PropField>

            {/* 繰り返し */}
            <PropField label="繰り返し">
              <Select
                value={task.recurrenceRule ? "_current" : "none"}
                onValueChange={(v) => {
                  if (v === "_current") return
                  const preset = v as RecurrencePreset
                  const rule = presetToRRule(preset, task.dueDate ? parseDateStr(task.dueDate) : undefined)
                  handleUpdate("recurrenceRule", rule)
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue>
                    {task.recurrenceRule ? rruleToText(task.recurrenceRule) : "なし"}
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
            </PropField>
          </div>

          {/* メンバー（2列グリッドの外。幅を使いたい） */}
          <div className="mt-2">
            <PropField label={`メンバー${detailsLoaded ? ` (${taskMembers.length})` : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                {taskMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-medium">
                      {m.displayName?.charAt(0) || "?"}
                    </div>
                    <span className="max-w-20 truncate">{m.displayName || "不明"}</span>
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                {availableMembers.length > 0 && (
                  <Select value="" onValueChange={(v) => v && handleAddMember(v)}>
                    <SelectTrigger className="h-6 w-auto min-w-0 border-dashed text-xs px-2 gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      追加
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.displayName || m.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </PropField>
          </div>
        </div>

        <div className="border-t mx-4" />

        {/* 説明 */}
        <div className="px-4 py-3">
          <SectionLabel>説明</SectionLabel>
          <Textarea
            className="text-sm min-h-28 resize-none break-all"
            placeholder="タスクの説明を入力..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setDescriptionDirty(true)
            }}
            onBlur={() => descriptionDirty && handleSaveDescription()}
          />
          {descriptionDirty && (
            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={handleSaveDescription}>
              保存
            </Button>
          )}
        </div>

        <div className="border-t mx-4" />

        {/* サブタスク */}
        <div className="px-4 py-3">
          <SectionLabel>
            サブタスク{detailsLoaded ? ` (${completedSubTasks}/${subTasks.length})` : ""}
          </SectionLabel>
          <div className="space-y-1">
            {/* プログレスバー */}
            {subTasks.length > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
                  style={{ width: `${subTaskProgress}%` }}
                />
              </div>
            )}

            {subTasks.map((st) => (
              <div key={st.id}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSubTaskStatusChange(st.id, st.status === "done" ? "todo" : "done")}
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                      st.status === "done"
                        ? "border-green-500 bg-green-500 text-white scale-110"
                        : "border-muted-foreground/40 hover:border-green-500 hover:scale-110"
                    )}
                  >
                    {st.status === "done" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span className={cn("text-sm truncate flex-1", st.status === "done" && "line-through text-muted-foreground")}>
                    {st.title}
                  </span>
                  <button
                    onClick={() => toggleSubTaskExpand(st.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="サブタスク"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn("transition-transform duration-200", expandedSubTasks.has(st.id) && "rotate-90")}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  {st._count && st._count.subTasks > 0 && (
                    <span className="text-[10px] text-muted-foreground">{st._count.subTasks}</span>
                  )}
                </div>

                {/* ネストサブタスク */}
                {expandedSubTasks.has(st.id) && (
                  <div className="ml-6 mt-1 space-y-1 border-l pl-2">
                    {(nestedSubTasks[st.id] || []).map((nst) => (
                      <div key={nst.id} className="flex items-center gap-2">
                        <button
                          onClick={() => handleNestedSubTaskStatusChange(st.id, nst.id, nst.status === "done" ? "todo" : "done")}
                          className={cn(
                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                            nst.status === "done"
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-muted-foreground/40 hover:border-green-500"
                          )}
                        >
                          {nst.status === "done" && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                        <span className={cn("text-xs truncate", nst.status === "done" && "line-through text-muted-foreground")}>
                          {nst.title}
                        </span>
                      </div>
                    ))}
                    {(nestedSubTasks[st.id] || []).length < 15 && (
                      <div className="flex gap-1.5 mt-1">
                        <Input
                          className="h-6 text-xs"
                          placeholder="サブタスクを追加..."
                          value={newNestedTitle[st.id] || ""}
                          onChange={(e) => setNewNestedTitle((prev) => ({ ...prev, [st.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddNestedSubTask(st.id) } }}
                        />
                        <Button size="xs" variant="outline" className="h-6 shrink-0 text-[10px]" onClick={() => handleAddNestedSubTask(st.id)}>
                          追加
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {subTasks.length < 15 && (
              <div className="flex gap-2 mt-2">
                <Input
                  className="h-7 text-sm"
                  placeholder="サブタスクを追加..."
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddSubTask() } }}
                />
                <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={handleAddSubTask}>
                  追加
                </Button>
              </div>
            )}
            {subTasks.length >= 15 && (
              <p className="text-[10px] text-muted-foreground mt-1">サブタスクの上限（15個）に達しています</p>
            )}
          </div>
        </div>

        <div className="border-t mx-4" />

        {/* コメント（タスク内チャット） */}
        <div className="px-4 py-3">
          <SectionLabel>
            チャット{detailsLoaded ? ` (${comments.length})` : ""}
          </SectionLabel>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium shrink-0">
                    {c.user.displayName?.charAt(0) || "?"}
                  </div>
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
                <p className="text-muted-foreground whitespace-pre-wrap ml-7">{c.content}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="メッセージを入力..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddComment() } }}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleAddComment}>
                送信
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">{label}</span>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold text-muted-foreground block mb-1.5">{children}</span>
  )
}
