"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

type Member = {
  id: string
  displayName: string | null
  avatarUrl: string | null
  email: string
  role: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberCount?: number
}

export function WorkspaceMembersDialog({ open, onOpenChange }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      fetchMembers()
    }
  }, [open])

  async function fetchMembers() {
    setLoading(true)
    const res = await fetch("/api/internal/members?includeSelf=true")
    if (res.ok) {
      setMembers(await res.json())
    }
    setLoading(false)
  }

  async function handleGenerateInvite() {
    setInviteLoading(true)
    try {
      const res = await fetch("/api/internal/workspaces/invite", { method: "POST" })
      if (res.ok) {
        const { inviteCode } = await res.json()
        setInviteUrl(`${window.location.origin}/invite/${inviteCode}`)
      }
    } catch {
      // エラー無視
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // フォールバック
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>メンバー</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      m.displayName?.charAt(0) || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.displayName || "不明"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {m.role === "admin" && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                      管理者
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* 招待セクション */}
          <div className="space-y-2">
            <p className="text-sm font-medium">メンバーを招待</p>
            {inviteUrl ? (
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs" />
                <Button onClick={handleCopy} variant="outline" size="sm" className="shrink-0">
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGenerateInvite}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={inviteLoading}
              >
                {inviteLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    生成中
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    招待リンクを生成
                  </span>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              リンクを共有すると、誰でもワークスペースに参加できます
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
