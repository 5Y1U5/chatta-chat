"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { LongPressTouchSensor } from "@/lib/LongPressTouchSensor"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { RecurrenceSelect } from "@/components/task/RecurrenceSelect"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { TaskInfo, TaskCommentInfo } from "@/types/chat"

type MemberInfo = { id: string; userId: string; displayName: string | null; avatarUrl: string | null }

type TaskDetailsCache = {
  subTasks: TaskInfo[]
  comments: TaskCommentInfo[]
  members: MemberInfo[]
  fetchedAt: number
}

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

// コメント添付ファイルの表示
function renderFileAttachment(fileUrl: string, fileName: string | null, fileType: string | null) {
  const isImage = fileType?.startsWith("image/")
  if (isImage) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={fileUrl} alt={fileName || ""} className="max-w-full max-h-48 rounded-md object-contain" />
      </a>
    )
  }
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1 p-2 rounded-md bg-muted/50 text-sm hover:bg-muted transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="truncate text-primary">{fileName || "ファイル"}</span>
    </a>
  )
}

// コメント内の @メンション を強調表示
function renderCommentContent(content: string) {
  const parts = content.split(/(@\S+)/g)
  if (parts.length === 1) return content
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
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
  // ナビゲーションスタック: サブタスクに潜る時にプッシュ
  const [viewStack, setViewStack] = useState<TaskInfo[]>([])
  // 現在表示中のタスク（スタックの先頭 or ルートタスク）
  const currentTask = viewStack.length > 0 ? viewStack[viewStack.length - 1] : task

  // キャッシュ: タスクID → 詳細データ
  const detailsCacheRef = useRef<Record<string, TaskDetailsCache>>({})

  const [title, setTitle] = useState(currentTask.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const [description, setDescription] = useState(currentTask.description || "")
  const [descriptionDirty, setDescriptionDirty] = useState(false)
  const [subTasks, setSubTasks] = useState<TaskInfo[]>([])
  const [comments, setComments] = useState<TaskCommentInfo[]>([])
  const [taskMembers, setTaskMembers] = useState<MemberInfo[]>([])
  const [newComment, setNewComment] = useState("")
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("")
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showMentionList, setShowMentionList] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // ルートタスクが切り替わったらスタックとキャッシュをリセット
  useEffect(() => {
    setViewStack([])
    detailsCacheRef.current = {}
  }, [task.id])

  // currentTask が変わったときに state を同期
  useEffect(() => {
    setTitle(currentTask.title)
    setEditingTitle(false)
    setDescription(currentTask.description || "")
    setDescriptionDirty(false)
    setNewComment("")
    setNewSubTaskTitle("")

    // キャッシュがあれば即座に表示
    const cached = detailsCacheRef.current[currentTask.id]
    if (cached) {
      setSubTasks(cached.subTasks)
      setComments(cached.comments)
      setTaskMembers(cached.members)
      setDetailsLoaded(true)
    } else {
      setSubTasks([])
      setComments([])
      setTaskMembers([])
      setDetailsLoaded(false)
    }
  }, [currentTask.id, currentTask.title, currentTask.description])

  // 詳細データの取得（キャッシュ有 → バックグラウンド再検証、キャッシュ無 → フル取得）
  const fetchDetails = useCallback(async (taskId: string) => {
    const [subRes, commentRes, memberRes] = await Promise.all([
      fetch(`/api/internal/tasks?parentTaskId=${taskId}`),
      fetch(`/api/internal/tasks/comments?taskId=${taskId}`),
      fetch(`/api/internal/tasks/members?taskId=${taskId}`),
    ])
    const newSubTasks = subRes.ok ? await subRes.json() : []
    const newComments = commentRes.ok ? await commentRes.json() : []
    const newMembers = memberRes.ok ? await memberRes.json() : []

    // キャッシュに保存
    detailsCacheRef.current[taskId] = {
      subTasks: newSubTasks,
      comments: newComments,
      members: newMembers,
      fetchedAt: Date.now(),
    }

    return { subTasks: newSubTasks, comments: newComments, members: newMembers }
  }, [])

  useEffect(() => {
    let cancelled = false
    const taskId = currentTask.id

    fetchDetails(taskId).then((data) => {
      if (cancelled) return
      setSubTasks(data.subTasks)
      setComments(data.comments)
      setTaskMembers(data.members)
      setDetailsLoaded(true)
    })

    return () => { cancelled = true }
  }, [currentTask.id, fetchDetails])

  // タイトル編集開始時にフォーカス
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // サブタスクへナビゲート
  const navigateToSubTask = useCallback((subTask: TaskInfo) => {
    setViewStack((prev) => [...prev, subTask])
  }, [])

  // パンくずリストで戻る
  const navigateBack = useCallback((index: number) => {
    // index = -1 → ルートタスクに戻る, 0 → スタックの1つ目まで, etc.
    if (index < 0) {
      setViewStack([])
    } else {
      setViewStack((prev) => prev.slice(0, index + 1))
    }
  }, [])

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

    // スタック内のタスクも更新
    if (viewStack.length > 0) {
      setViewStack((prev) =>
        prev.map((t) => (t.id === currentTask.id ? { ...t, ...optimistic } : t))
      )
    }

    // ルートタスクの場合は親コンポーネントに通知
    if (currentTask.id === task.id) {
      onOptimisticUpdate(task.id, optimistic)
    }

    fetch("/api/internal/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: currentTask.id, [field]: value }),
    })
  }

  const handleSaveTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== currentTask.title) {
      handleUpdate("title", trimmed)
    } else {
      setTitle(currentTask.title)
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
      projectId: currentTask.projectId,
      parentTaskId: currentTask.id,
      title: newSubTaskTitle.trim(),
      description: null,
      status: "todo",
      priority: "medium",
      assigneeId: currentTask.assigneeId,
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
      assignee: currentTask.assignee,
      creator: members.find((m) => m.id === currentUserId) || { id: currentUserId, displayName: null, avatarUrl: null },
      project: currentTask.project,
      _count: { subTasks: 0, comments: 0 },
    }

    setSubTasks((prev) => [...prev, tempSubTask])

    // ルートタスクの場合のみ親の _count を更新
    if (currentTask.id === task.id) {
      onOptimisticUpdate(task.id, {
        _count: { subTasks: subTasks.length + 1, comments: task._count?.comments || 0 },
      })
    }

    const t = newSubTaskTitle.trim()
    setNewSubTaskTitle("")

    fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        parentTaskId: currentTask.id,
        projectId: currentTask.projectId,
        assigneeId: currentTask.assigneeId,
      }),
    }).then(async (res) => {
      if (res.ok) {
        const realTask = await res.json()
        setSubTasks((prev) => prev.map((st) => (st.id === tempId ? realTask : st)))
        // キャッシュも更新
        if (detailsCacheRef.current[currentTask.id]) {
          detailsCacheRef.current[currentTask.id].subTasks = subTasks.map((st) =>
            st.id === tempId ? realTask : st
          )
        }
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
      body: JSON.stringify({ taskId: currentTask.id, userId }),
    })
  }

  const handleRemoveMember = (userId: string) => {
    setTaskMembers((prev) => prev.filter((m) => m.userId !== userId))
    fetch(`/api/internal/tasks/members?taskId=${currentTask.id}&userId=${userId}`, { method: "DELETE" })
  }

  // メンション挿入
  const handleInsertMention = (name: string) => {
    const mention = `@${name} `
    setNewComment((prev) => prev + mention)
    setShowMentionList(false)
    // 入力欄にフォーカスを戻す
    setTimeout(() => commentInputRef.current?.focus(), 50)
  }

  // ファイル選択ハンドラ
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // 楽観的コメント追加（ファイル対応）
  const handleAddComment = async () => {
    if (!newComment.trim() && !pendingFile) return

    const currentMember = members.find((m) => m.id === currentUserId)
    const tempComment: TaskCommentInfo = {
      id: crypto.randomUUID(),
      taskId: currentTask.id,
      content: newComment.trim(),
      fileUrl: pendingFile ? URL.createObjectURL(pendingFile) : null,
      fileName: pendingFile?.name || null,
      fileType: pendingFile?.type || null,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUserId,
        displayName: currentMember?.displayName || null,
        avatarUrl: currentMember?.avatarUrl || null,
      },
    }

    setComments((prev) => [...prev, tempComment])

    if (currentTask.id === task.id) {
      onOptimisticUpdate(task.id, {
        _count: { subTasks: task._count?.subTasks || 0, comments: (task._count?.comments || 0) + 1 },
      })
    }

    const content = newComment.trim()
    const file = pendingFile
    setNewComment("")
    setPendingFile(null)

    // ファイルアップロード
    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileType: string | null = null
    if (file) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/internal/upload", { method: "POST", body: formData })
        if (uploadRes.ok) {
          const data = await uploadRes.json()
          fileUrl = data.fileUrl
          fileName = data.fileName
          fileType = data.fileType
        }
      } catch {
        // アップロード失敗しても本文は送信
      } finally {
        setUploading(false)
      }
    }

    fetch("/api/internal/tasks/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: currentTask.id, content, fileUrl, fileName, fileType }),
    })
  }

  const handleDelete = () => {
    if (!confirm("このタスクを削除しますか？")) return

    if (viewStack.length > 0) {
      // サブタスク表示中 → 親に戻って、サブタスク一覧からも削除
      const deletedId = currentTask.id
      setViewStack((prev) => prev.slice(0, -1))
      // 親のサブタスク一覧からも削除（次のレンダリングで反映）
      setTimeout(() => {
        setSubTasks((prev) => prev.filter((t) => t.id !== deletedId))
      }, 0)
      fetch(`/api/internal/tasks?taskId=${deletedId}`, { method: "DELETE" })
    } else {
      onTaskDeleted(task.id)
      fetch(`/api/internal/tasks?taskId=${task.id}`, { method: "DELETE" })
    }
  }

  // メンバー追加候補
  const memberIds = new Set(taskMembers.map((m) => m.userId))
  const availableMembers = members.filter((m) => !memberIds.has(m.id))

  // メンション対象: タスク関係者（担当者 + 作成者 + TaskMember）から自分を除外
  const mentionTargets = useMemo(() => {
    const ids = new Set<string>()
    const targets: { id: string; displayName: string | null }[] = []
    const addTarget = (id: string, name: string | null) => {
      if (id === currentUserId || ids.has(id)) return
      ids.add(id)
      targets.push({ id, displayName: name })
    }
    if (currentTask.assigneeId && currentTask.assignee) {
      addTarget(currentTask.assigneeId, currentTask.assignee.displayName)
    }
    if (currentTask.creator) {
      addTarget(currentTask.creatorId, currentTask.creator.displayName)
    }
    for (const m of taskMembers) {
      addTarget(m.userId, m.displayName)
    }
    return targets
  }, [currentTask.assigneeId, currentTask.assignee, currentTask.creatorId, currentTask.creator, taskMembers, currentUserId])

  const completedSubTasks = subTasks.filter((t) => t.status === "done").length
  const subTaskProgress = subTasks.length > 0 ? (completedSubTasks / subTasks.length) * 100 : 0

  // サブタスク並び替え用
  const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(null)
  const subTaskDesktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const subTaskMobileSensors = useSensors(
    useSensor(LongPressTouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  )
  const subTaskSensors = isMobile ? subTaskMobileSensors : subTaskDesktopSensors
  const subTaskIds = useMemo(() => subTasks.map((t) => t.id), [subTasks])

  const handleSubTaskDragStart = useCallback((event: DragStartEvent) => {
    setActiveSubTaskId(event.active.id as string)
  }, [])

  const handleSubTaskDragEnd = useCallback((event: DragEndEvent) => {
    setActiveSubTaskId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = subTasks.findIndex((t) => t.id === active.id)
    const newIndex = subTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...subTasks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    const updated = reordered.map((t, i) => ({ ...t, sortOrder: i }))
    setSubTasks(updated)

    fetch("/api/internal/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: updated.map((t) => t.id) }),
    })
  }, [subTasks])

  const handleSubTaskDragCancel = useCallback(() => {
    setActiveSubTaskId(null)
  }, [])

  const activeSubTask = activeSubTaskId ? subTasks.find((t) => t.id === activeSubTaskId) : null

  // パンくずリスト用の階層情報
  const breadcrumbs = useMemo(() => {
    const items: { id: string; title: string; index: number }[] = [
      { id: task.id, title: task.title, index: -1 },
    ]
    viewStack.forEach((t, i) => {
      items.push({ id: t.id, title: t.title, index: i })
    })
    return items
  }, [task.id, task.title, viewStack])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:static md:inset-auto md:z-auto md:w-96 md:shrink-0 md:border-l lg:w-[28rem] animate-in slide-in-from-right-5 duration-200 overflow-hidden">
      {/* ヘッダー: 閉じる・完了ボタン・アクション */}
      <div className="shrink-0 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted text-muted-foreground touch-manipulation"
              onClick={viewStack.length > 0 ? () => navigateBack(viewStack.length - 2) : onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {/* PC: 完了ボタンを左側に配置 */}
            <Button
              size="sm"
              variant={currentTask.status === "done" ? "outline" : "default"}
              className={cn(
                "hidden md:inline-flex h-7 text-xs",
                currentTask.status === "done" && "border-primary text-primary hover:bg-blue-50 dark:hover:bg-blue-950/20"
              )}
              onClick={() => handleUpdate("status", currentTask.status === "done" ? "todo" : "done")}
            >
              {currentTask.status === "done" ? (
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
            {/* モバイル: 完了ボタンを右側に配置（戻るボタンと離す） */}
            <Button
              size="sm"
              variant={currentTask.status === "done" ? "outline" : "default"}
              className={cn(
                "md:hidden h-7 text-xs",
                currentTask.status === "done" && "border-primary text-primary hover:bg-blue-50 dark:hover:bg-blue-950/20"
              )}
              onClick={() => handleUpdate("status", currentTask.status === "done" ? "todo" : "done")}
            >
              {currentTask.status === "done" ? (
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title="リンクをコピー"
              onClick={async () => {
                const url = `${window.location.origin}/${workspaceId}/tasks?taskId=${currentTask.id}`
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
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
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
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
        {/* パンくずリスト（サブタスク表示中のみ） */}
        {viewStack.length > 0 && (
          <div className="px-4 pt-2 pb-0 flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
            {breadcrumbs.map((bc, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={bc.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  {isLast ? (
                    <span className="text-foreground font-medium truncate max-w-32">
                      {bc.title}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigateBack(bc.index)}
                      className="hover:text-foreground transition-colors truncate max-w-24"
                    >
                      {bc.title}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}

        {/* 戻るボタン（デスクトップ、サブタスク表示中のみ） */}
        {viewStack.length > 0 && (
          <div className="px-4 pt-2 hidden md:block">
            <button
              onClick={() => navigateBack(viewStack.length - 2)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              親タスクに戻る
            </button>
          </div>
        )}

        {/* コラボレーター（Asanaスタイル） */}
        {detailsLoaded && (
          <div className="px-4 pt-3 flex items-center gap-1.5">
            {/* 担当者アバター */}
            {currentTask.assignee && (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-primary/10 text-xs font-medium shrink-0 ring-2 ring-background",
                  isMobile ? "h-8 w-8" : "h-7 w-7 text-[10px]"
                )}
                title={`担当: ${currentTask.assignee.displayName || "不明"}`}
              >
                {currentTask.assignee.avatarUrl ? (
                  <img src={currentTask.assignee.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  currentTask.assignee.displayName?.charAt(0) || "?"
                )}
              </div>
            )}
            {/* 作成者アバター（担当者と異なる場合） */}
            {currentTask.creator && currentTask.creatorId !== currentTask.assigneeId && (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0 ring-2 ring-background -ml-2",
                  isMobile ? "h-8 w-8" : "h-7 w-7 text-[10px]"
                )}
                title={`作成者: ${currentTask.creator.displayName || "不明"}`}
              >
                {currentTask.creator.avatarUrl ? (
                  <img src={currentTask.creator.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  currentTask.creator.displayName?.charAt(0) || "?"
                )}
              </div>
            )}
            {/* TaskMember アバター */}
            {taskMembers.map((m) => (
              <div
                key={m.userId}
                className={cn(
                  "flex items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0 ring-2 ring-background -ml-2",
                  isMobile ? "h-8 w-8" : "h-7 w-7 text-[10px]"
                )}
                title={m.displayName || "不明"}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  m.displayName?.charAt(0) || "?"
                )}
              </div>
            ))}
            {/* メンバー追加ボタン */}
            {availableMembers.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors",
                      isMobile ? "h-8 w-8 -ml-1" : "h-7 w-7 -ml-1"
                    )}
                    title="コラボレーターを追加"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? "16" : "14"} height={isMobile ? "16" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-56 p-1">
                  <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">コラボレーターを追加</p>
                  {availableMembers.map((m) => (
                    <button
                      key={m.id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                      onClick={() => handleAddMember(m.id)}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          m.displayName?.charAt(0) || "?"
                        )}
                      </div>
                      {m.displayName || m.id.slice(0, 8)}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* タイトル（編集可能） */}
        <div className="px-4 pt-3 pb-2">
          {editingTitle ? (
            <textarea
              ref={titleInputRef}
              className={cn("w-full font-bold resize-none border-0 bg-transparent outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1", isMobile ? "text-xl" : "text-lg")}
              value={title}
              rows={Math.min(Math.ceil(title.length / 30) || 1, 3)}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleSaveTitle() }
                if (e.key === "Escape") { setTitle(currentTask.title); setEditingTitle(false) }
              }}
            />
          ) : (
            <h2
              className={cn("font-bold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors", isMobile ? "text-xl" : "text-lg")}
              onClick={() => setEditingTitle(true)}
            >
              {currentTask.title}
            </h2>
          )}
        </div>

        {/* プロパティ: 2列グリッド */}
        <div className="px-4 pb-3">
          <div className={cn("grid grid-cols-2", isMobile ? "gap-x-4 gap-y-3" : "gap-x-3 gap-y-2")}>
            {/* 優先度 */}
            <PropField label="優先度" mobile={isMobile}>
              <Select value={currentTask.priority} onValueChange={(v) => handleUpdate("priority", v)}>
                <SelectTrigger className={isMobile ? "h-9 text-sm" : "h-7 text-xs"}>
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
            <PropField label="担当者" mobile={isMobile}>
              <Select
                value={currentTask.assigneeId || "_none"}
                onValueChange={(v) => handleUpdate("assigneeId", v === "_none" ? null : v)}
              >
                <SelectTrigger className={isMobile ? "h-9 text-sm" : "h-7 text-xs"}>
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
            <PropField label="期日" mobile={isMobile}>
              <DatePicker
                value={currentTask.dueDate ? parseDateStr(currentTask.dueDate) : undefined}
                onChange={(date) => handleUpdate("dueDate", date ? formatDateLocal(date) : null)}
                className={cn("w-full", isMobile ? "h-9 text-sm" : "h-7 text-xs")}
              />
            </PropField>

            {/* プロジェクト */}
            <PropField label="プロジェクト" mobile={isMobile}>
              <Select
                value={currentTask.projectId || "_none"}
                onValueChange={(v) => handleUpdate("projectId", v === "_none" ? null : v)}
              >
                <SelectTrigger className={isMobile ? "h-9 text-sm" : "h-7 text-xs"}>
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
            <PropField label="繰り返し" mobile={isMobile}>
              <RecurrenceSelect
                value={currentTask.recurrenceRule || null}
                onChange={(rule) => handleUpdate("recurrenceRule", rule)}
                dueDate={currentTask.dueDate ? parseDateStr(currentTask.dueDate) : undefined}
                compact={!isMobile}
              />
            </PropField>
          </div>

        </div>

        <div className="border-t mx-4" />

        {/* 説明 */}
        <div className="px-4 py-3">
          <SectionLabel mobile={isMobile}>説明</SectionLabel>
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
          <SectionLabel mobile={isMobile}>
            サブタスク{detailsLoaded ? ` (${completedSubTasks}/${subTasks.length})` : ""}
          </SectionLabel>
          <div className="space-y-1">
            {/* プログレスバー */}
            {subTasks.length > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${subTaskProgress}%` }}
                />
              </div>
            )}

            <DndContext
              sensors={subTaskSensors}
              collisionDetection={closestCenter}
              onDragStart={handleSubTaskDragStart}
              onDragEnd={handleSubTaskDragEnd}
              onDragCancel={handleSubTaskDragCancel}
              autoScroll={{ threshold: { x: 0, y: 0.2 }, interval: 5 }}
            >
              <SortableContext items={subTaskIds} strategy={verticalListSortingStrategy}>
                {subTasks.map((st) => (
                  <SortableSubTaskItem
                    key={st.id}
                    subTask={st}
                    onStatusChange={handleSubTaskStatusChange}
                    onNavigate={navigateToSubTask}
                    isMobile={isMobile}
                  />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeSubTask && (
                  <div
                    style={{
                      transform: "scale(1.03)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                      borderRadius: "6px",
                      background: "var(--color-card, white)",
                      opacity: 0.95,
                      padding: "4px 8px",
                      fontSize: "13px",
                    }}
                  >
                    {activeSubTask.title}
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {subTasks.length < 15 && (
              <div className="flex gap-2 mt-2">
                <Input
                  className={cn(isMobile ? "h-9 text-sm" : "h-7 text-sm")}
                  placeholder="サブタスクを追加..."
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddSubTask() } }}
                />
                <Button size="sm" variant="outline" className={cn("shrink-0", isMobile ? "h-9" : "h-7")} onClick={handleAddSubTask}>
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
        <div className={cn("px-4", isMobile ? "py-4 pb-2" : "py-3")}>
          <SectionLabel mobile={isMobile}>
            チャット{detailsLoaded ? ` (${comments.length})` : ""}
          </SectionLabel>
          <div className={cn(isMobile ? "space-y-4" : "space-y-3")}>
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 items-start text-sm">
                <div className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-muted font-medium mt-0.5 overflow-hidden",
                  isMobile ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]"
                )}>
                  {c.user.avatarUrl ? (
                    <img src={c.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    c.user.displayName?.charAt(0) || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={cn("font-medium", isMobile ? "text-sm" : "text-xs")}>{c.user.displayName || "不明"}</span>
                    <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-[10px]")}>
                      {new Date(c.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {c.content && (
                    <p className={cn("whitespace-pre-wrap", isMobile ? "text-sm" : "text-sm text-foreground/90")}>
                      {renderCommentContent(c.content)}
                    </p>
                  )}
                  {c.fileUrl && renderFileAttachment(c.fileUrl, c.fileName, c.fileType)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* モバイル: スクロール末尾の余白（下部固定バーの裏に隠れないよう） */}
        {isMobile && <div className="h-32" />}
      </div>

      {/* 隠しファイル入力 */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={handleFileSelect} className="hidden" />

      {/* 入力エリア — モバイル: 下部固定, PC: インライン */}
      <div className={cn(
        "shrink-0 border-t bg-background",
        isMobile ? "px-4 pb-[env(safe-area-inset-bottom)] pt-2" : "px-4 py-3"
      )}>
        {/* 添付ファイルプレビュー */}
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted/50 text-sm">
            {pendingFile.type.startsWith("image/") ? (
              <img src={URL.createObjectURL(pendingFile)} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            )}
            <span className="flex-1 truncate">{pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* テキスト入力 */}
        <Input
          ref={commentInputRef}
          className={cn(isMobile ? "h-10 text-sm rounded-lg" : "h-8 text-sm")}
          placeholder="質問や最新情報を投稿..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddComment() } }}
          disabled={uploading}
        />

        {/* ツールバー行: アイコンボタン + コラボレーター + 送信 */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0.5">
            {/* カメラ撮影 */}
            <button
              title="カメラで撮影"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors",
                isMobile ? "h-10 w-10" : "h-8 w-8"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? "20" : "16"} height={isMobile ? "20" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>

            {/* 写真を選択 */}
            <button
              title="写真を選択"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors",
                isMobile ? "h-10 w-10" : "h-8 w-8"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? "20" : "16"} height={isMobile ? "20" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>

            {/* ファイル添付 */}
            <button
              title="ファイルを添付"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors",
                isMobile ? "h-10 w-10" : "h-8 w-8"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? "20" : "16"} height={isMobile ? "20" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* メンション */}
            {mentionTargets.length > 0 && (
              <Popover open={showMentionList} onOpenChange={setShowMentionList}>
                <PopoverTrigger asChild>
                  <button
                    title="メンション"
                    className={cn(
                      "flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                      isMobile ? "h-10 w-10" : "h-8 w-8"
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? "20" : "16"} height={isMobile ? "20" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-56 p-1">
                  <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">メンション</p>
                  {mentionTargets.map((t) => (
                    <button
                      key={t.id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                      onClick={() => handleInsertMention(t.displayName || t.id.slice(0, 8))}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">
                        {t.displayName?.charAt(0) || "?"}
                      </div>
                      {t.displayName || t.id.slice(0, 8)}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* 右側: コラボレーター + 送信 */}
          <div className="flex items-center gap-1.5">
            {/* コラボレーターアバター（コンパクト） */}
            {detailsLoaded && (
              <div className="flex items-center">
                {[
                  currentTask.assignee && { id: currentTask.assigneeId!, name: currentTask.assignee.displayName, avatar: currentTask.assignee.avatarUrl },
                  ...(currentTask.creator && currentTask.creatorId !== currentTask.assigneeId
                    ? [{ id: currentTask.creatorId, name: currentTask.creator.displayName, avatar: currentTask.creator.avatarUrl }]
                    : []),
                  ...taskMembers.map((m) => ({ id: m.userId, name: m.displayName, avatar: m.avatarUrl })),
                ].filter(Boolean).slice(0, 3).map((p, i) => (
                  <div
                    key={p!.id}
                    className={cn(
                      "flex items-center justify-center rounded-full bg-muted text-[8px] font-medium shrink-0 ring-2 ring-background overflow-hidden",
                      isMobile ? "h-7 w-7" : "h-6 w-6",
                      i > 0 && "-ml-1.5"
                    )}
                    title={p!.name || ""}
                  >
                    {p!.avatar ? (
                      <img src={p!.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      p!.name?.charAt(0) || "?"
                    )}
                  </div>
                ))}
                {availableMembers.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors -ml-1",
                          isMobile ? "h-7 w-7" : "h-6 w-6"
                        )}
                        title="コラボレーターを追加"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-56 p-1">
                      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">コラボレーターを追加</p>
                      {availableMembers.map((m) => (
                        <button
                          key={m.id}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                          onClick={() => handleAddMember(m.id)}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0 overflow-hidden">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              m.displayName?.charAt(0) || "?"
                            )}
                          </div>
                          {m.displayName || m.id.slice(0, 8)}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* 送信ボタン */}
            <Button
              size="sm"
              className={cn("shrink-0 rounded-full", isMobile ? "h-9 w-9 p-0" : "h-8 w-8 p-0")}
              onClick={handleAddComment}
              disabled={(!newComment.trim() && !pendingFile) || uploading}
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
      </div>
    </div>
  )
}

// ドラッグ可能なサブタスクアイテム（クリックで詳細にナビゲート）
const SortableSubTaskItem = memo(function SortableSubTaskItem({
  subTask,
  onStatusChange,
  onNavigate,
  isMobile,
}: {
  subTask: TaskInfo
  onStatusChange: (id: string, status: string) => void
  onNavigate: (task: TaskInfo) => void
  isMobile: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subTask.id })

  // ドラッグ中はクリックを無効化
  const isDraggingRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      isDraggingRef.current = true
    } else {
      const timer = setTimeout(() => { isDraggingRef.current = false }, 200)
      return () => clearTimeout(timer)
    }
  }, [isDragging])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? -1 : undefined,
  }

  // 優先度のインジケーター色
  const priorityColor = subTask.priority === "high"
    ? "bg-red-500"
    : subTask.priority === "low"
      ? "bg-gray-300 dark:bg-gray-600"
      : ""

  const handleNavigate = useCallback(() => {
    if (!isDraggingRef.current) onNavigate(subTask)
  }, [onNavigate, subTask])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group/subtask", isMobile && "touch-manipulation")}
      {...(isMobile ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center gap-2">
        {/* ドラッグハンドル（デスクトップのみ） */}
        {!isMobile && (
          <div
            {...attributes}
            {...listeners}
            className="flex shrink-0 items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/subtask:opacity-100 transition-opacity touch-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        )}
        {/* チェックボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStatusChange(subTask.id, subTask.status === "done" ? "todo" : "done")
          }}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
            subTask.status === "done"
              ? "border-primary bg-primary text-white scale-110"
              : "border-muted-foreground/40 hover:border-primary hover:scale-110"
          )}
        >
          {subTask.status === "done" && (
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        {/* 優先度インジケーター */}
        {priorityColor && (
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityColor)} />
        )}
        {/* タイトル（クリックでナビゲート） */}
        <button
          onClick={handleNavigate}
          className={cn(
            "text-sm text-left truncate flex-1 hover:text-primary transition-colors",
            subTask.status === "done" && "line-through text-muted-foreground"
          )}
          title={subTask.title}
        >
          {subTask.title}
        </button>
        {/* サブタスク数・コメント数バッジ */}
        <div className="flex items-center gap-1.5 shrink-0">
          {subTask._count && subTask._count.subTasks > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="サブタスク">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
              </svg>
              {subTask._count.subTasks}
            </span>
          )}
          {subTask._count && subTask._count.comments > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="コメント">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {subTask._count.comments}
            </span>
          )}
          {/* 開くアイコン */}
          <button
            onClick={handleNavigate}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="詳細を開く"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
})

function PropField({ label, children, mobile }: { label: string; children: React.ReactNode; mobile?: boolean }) {
  return (
    <div>
      <span className={cn(
        "font-medium text-muted-foreground block",
        mobile ? "text-xs mb-1" : "text-[10px] mb-0.5"
      )}>{label}</span>
      {children}
    </div>
  )
}

function SectionLabel({ children, mobile }: { children: React.ReactNode; mobile?: boolean }) {
  return (
    <span className={cn(
      "font-semibold text-muted-foreground block",
      mobile ? "text-sm mb-2" : "text-xs mb-1.5"
    )}>{children}</span>
  )
}
