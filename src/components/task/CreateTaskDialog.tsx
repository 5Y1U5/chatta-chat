"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DatePicker } from "@/components/ui/date-picker"
import { RECURRENCE_PRESETS, presetToRRule, type RecurrencePreset } from "@/lib/recurrence"
import { useIsMobile } from "@/hooks/useIsMobile"

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
  projects: { id: string; name: string; color: string | null }[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  defaultProjectId?: string
  workspaceId: string
  currentUserId?: string
}

export function CreateTaskDialog({
  open,
  onClose,
  onCreated,
  projects,
  members,
  defaultProjectId,
  currentUserId,
}: Props) {
  const isMobile = useIsMobile()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(defaultProjectId || "")
  const [assigneeId, setAssigneeId] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [recurrence, setRecurrence] = useState<RecurrencePreset>("none")
  const [submitting, setSubmitting] = useState(false)
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [file, setFile] = useState<{ url: string; name: string; type: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // モバイルでは currentUserId をデフォルト担当者にする
  const effectiveAssigneeId = assigneeId || (isMobile && currentUserId ? currentUserId : "")

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setProjectId(defaultProjectId || "")
    setAssigneeId("")
    setPriority("medium")
    setDueDate(undefined)
    setRecurrence("none")
    setCollaboratorIds([])
    setFile(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setUploading(true)
    const formData = new FormData()
    formData.append("file", selected)
    const res = await fetch("/api/internal/upload", { method: "POST", body: formData })
    if (res.ok) {
      const data = await res.json()
      setFile({ url: data.fileUrl, name: data.fileName, type: data.fileType })
    }
    setUploading(false)
    // input をリセットして同じファイルを再選択可能に
    e.target.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    const res = await fetch("/api/internal/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: isMobile ? null : (description.trim() || null),
        projectId: projectId || null,
        assigneeId: effectiveAssigneeId || null,
        priority: isMobile ? "medium" : priority,
        dueDate: dueDate ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}` : null,
        recurrenceRule: isMobile ? null : presetToRRule(recurrence, dueDate),
        fileUrl: file?.url || null,
        fileName: file?.name || null,
        fileType: file?.type || null,
      }),
    })

    if (res.ok) {
      // コラボレーターを追加
      if (collaboratorIds.length > 0) {
        const task = await res.json()
        await Promise.all(
          collaboratorIds.map((userId) =>
            fetch("/api/internal/tasks/members", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: task.id, userId }),
            })
          )
        )
      }
      resetForm()
      onCreated()
    }
    setSubmitting(false)
  }

  // モバイル用ボトムシート
  if (isMobile) {
    const currentMember = members.find((m) => m.id === currentUserId)
    const assigneeMember = assigneeId
      ? members.find((m) => m.id === assigneeId)
      : currentMember

    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-2" showCloseButton={false}>
          {/* ドラッグハンドル */}
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />

          <SheetHeader className="p-0 mb-3">
            <SheetTitle className="text-base">タスクを作成</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* タスク名 */}
            <Input
              placeholder="タスク名"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="text-base"
            />

            {/* 担当者 + 期日 */}
            <div className="flex items-center gap-2">
              {/* 担当者 */}
              <Select
                value={effectiveAssigneeId || "_none"}
                onValueChange={(v) => setAssigneeId(v === "_none" ? "" : v)}
              >
                <SelectTrigger className="h-9 flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {assigneeMember?.displayName?.charAt(0) || "?"}
                    </div>
                    <span className="truncate">
                      {assigneeMember?.displayName || "担当者"}
                    </span>
                  </div>
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

              {/* 期日 */}
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="期日"
                className="h-9 flex-1"
              />
            </div>

            {/* コラボレーター */}
            {members.length > 1 && (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 選択済みコラボレーターのアバター */}
                  {collaboratorIds.map((id) => {
                    const m = members.find((m) => m.id === id)
                    if (!m) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        className="flex items-center gap-1 rounded-full bg-muted pl-1 pr-2 py-0.5 text-xs"
                        onClick={() => setCollaboratorIds((prev) => prev.filter((i) => i !== id))}
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
                          {m.displayName?.charAt(0) || "?"}
                        </div>
                        <span className="truncate max-w-20">{m.displayName || "?"}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )
                  })}

                  {/* 追加ボタン */}
                  {(() => {
                    const excludeIds = new Set([...collaboratorIds, effectiveAssigneeId])
                    const available = members.filter((m) => !excludeIds.has(m.id))
                    if (available.length === 0) return null
                    return (
                      <Select
                        value=""
                        onValueChange={(v) => {
                          if (v && !collaboratorIds.includes(v)) {
                            setCollaboratorIds((prev) => [...prev, v])
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-auto gap-1 border-dashed text-xs text-muted-foreground px-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                          </svg>
                          <span>メンバー追加</span>
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.displayName || m.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 添付ファイル */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs flex-1 min-w-0">
                  {file.type.startsWith("image/") ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-500">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-muted"
                    onClick={() => setFile(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      ファイルを添付
                    </>
                  )}
                </button>
              )}
            </div>

            {/* 作成ボタン */}
            <Button
              type="submit"
              disabled={!title.trim() || submitting || uploading}
              className="w-full h-10"
            >
              {submitting ? "作成中..." : "作成"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    )
  }

  // PC用: 従来の Dialog
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>タスクを作成</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div>
            <Input
              placeholder="タスク名"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <Textarea
              placeholder="説明（任意）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">担当者</label>
              <Select value={assigneeId || "_none"} onValueChange={(v) => setAssigneeId(v === "_none" ? "" : v)}>
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
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">優先度</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">プロジェクト</label>
              <Select value={projectId || "_none"} onValueChange={(v) => setProjectId(v === "_none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">なし</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">期日</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">繰り返し</label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrencePreset)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!title.trim() || submitting}>
              {submitting ? "作成中..." : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
