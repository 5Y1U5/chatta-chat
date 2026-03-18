"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  async function handleOpen(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) {
      await fetchInviteCode()
    }
  }

  async function fetchInviteCode() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/internal/workspaces/invite", {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "招待リンクの生成に失敗しました")
        return
      }

      const { inviteCode } = await res.json()
      setInviteUrl(`${window.location.origin}/invite/${inviteCode}`)
    } catch {
      setError("招待リンクの生成に失敗しました")
    } finally {
      setLoading(false)
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
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="メンバーを招待"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メンバーを招待</DialogTitle>
          <DialogDescription>
            招待リンクを共有してメンバーを追加できます
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {error && (
            <div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">生成中...</p>
          ) : inviteUrl ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-sm" />
                <Button onClick={handleCopy} variant="outline" className="shrink-0">
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                このリンクを共有すると、誰でもワークスペースに参加できます
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
