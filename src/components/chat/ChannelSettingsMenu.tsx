"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ChannelInfo } from "@/types/chat"

type Props = {
  channel: ChannelInfo
  workspaceId: string
}

export function ChannelSettingsMenu({ channel, workspaceId }: Props) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newName, setNewName] = useState(channel.name || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // マイチャット・DM はメニュー非表示
  const isMyChat = channel.name === "マイチャット" && channel.type === "public"
  if (isMyChat || channel.type === "dm") return null

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/internal/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, name: newName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "名称変更に失敗しました")
        return
      }

      setRenameOpen(false)
      router.refresh()
    } catch {
      setError("名称変更に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setError("")
    setLoading(true)

    try {
      const res = await fetch(
        `/api/internal/channels?channelId=${channel.id}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "削除に失敗しました")
        return
      }

      setDeleteOpen(false)
      router.push(`/${workspaceId}`)
      router.refresh()
    } catch {
      setError("削除に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setNewName(channel.name || "")
              setError("")
              setRenameOpen(true)
            }}
          >
            名称変更
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              setError("")
              setDeleteOpen(true)
            }}
          >
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 名称変更ダイアログ */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>グループチャット名を変更</DialogTitle>
              <DialogDescription>
                新しいグループチャット名を入力してください
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {error && (
                <div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newChannelName">グループチャット名</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#</span>
                  <Input
                    id="newChannelName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="新しい名前"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!newName.trim() || loading}>
                {loading ? "変更中..." : "変更"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>グループチャットを削除</DialogTitle>
            <DialogDescription>
              「{channel.name}」を削除しますか？すべてのメッセージが完全に削除され、この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "削除中..." : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
