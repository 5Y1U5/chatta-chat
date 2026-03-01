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
  DialogTrigger,
} from "@/components/ui/dialog"

type Props = {
  workspaceId: string
}

export function NewChannelDialog({ workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/internal/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: "public" }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "グループチャット作成に失敗しました")
        return
      }

      const { id } = await res.json()
      setOpen(false)
      setName("")
      router.push(`/${workspaceId}/channel/${id}`)
      router.refresh()
    } catch {
      setError("グループチャット作成に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>グループチャットを作成</DialogTitle>
            <DialogDescription>
              新しいグループチャットを作成します
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="channelName">グループチャット名</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#</span>
                <Input
                  id="channelName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: random"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
