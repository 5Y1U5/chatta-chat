"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Member = {
  id: string
  displayName: string | null
  email: string
}

type Props = {
  workspaceId: string
}

export function NewDmDialog({ workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return

    setLoading(true)
    fetch("/api/internal/members")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMembers(data)
      })
      .finally(() => setLoading(false))
  }, [open])

  async function handleSelect(targetUserId: string) {
    setCreating(true)
    try {
      const res = await fetch("/api/internal/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      })

      if (!res.ok) return

      const { id } = await res.json()
      setOpen(false)
      router.push(`/${workspaceId}/channel/${id}`)
    } finally {
      setCreating(false)
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
        <DialogHeader>
          <DialogTitle>ダイレクトメッセージ</DialogTitle>
          <DialogDescription>
            メッセージを送る相手を選択してください
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              読み込み中...
            </p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              他のメンバーがいません
            </p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelect(member.id)}
                  disabled={creating}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {member.displayName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="font-medium">
                      {member.displayName || "不明"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
