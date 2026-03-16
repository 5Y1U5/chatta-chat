"use client"

import { useState } from "react"
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
      }),
    })

    if (res.ok) {
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

            {/* 作成ボタン */}
            <Button
              type="submit"
              disabled={!title.trim() || submitting}
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
