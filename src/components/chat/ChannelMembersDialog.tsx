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
  avatarUrl?: string | null
}

type Props = {
  channelId: string
  channelType: string
  currentUserId: string
}

export function ChannelMembersDialog({ channelId, channelType, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [channelMembers, setChannelMembers] = useState<Member[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    loadMembers()
  }, [open, channelId])

  async function loadMembers() {
    setLoading(true)
    try {
      const [chRes, wsRes] = await Promise.all([
        fetch(`/api/internal/channels/members?channelId=${channelId}`),
        fetch("/api/internal/members"),
      ])

      const chData = await chRes.json()
      const wsData = await wsRes.json()

      if (Array.isArray(chData)) setChannelMembers(chData)
      if (Array.isArray(wsData)) setWorkspaceMembers(wsData)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateInvite() {
    setInviteLoading(true)
    try {
      const res = await fetch("/api/internal/channels/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      })
      if (res.ok) {
        const { inviteCode } = await res.json()
        setInviteLink(`${window.location.origin}/ch/${inviteCode}`)
      }
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // チャンネルに未参加のワークスペースメンバー
  const channelMemberIds = new Set(channelMembers.map((m) => m.id))
  const nonMembers = workspaceMembers.filter(
    (m) => !channelMemberIds.has(m.id) && m.id !== currentUserId
  )

  async function handleAdd(userId: string) {
    setActionLoading(userId)
    try {
      const res = await fetch("/api/internal/channels/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, userId }),
      })
      if (res.ok) {
        await loadMembers()
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRemove(userId: string) {
    setActionLoading(userId)
    try {
      const res = await fetch("/api/internal/channels/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, userId }),
      })
      if (res.ok) {
        await loadMembers()
      }
    } finally {
      setActionLoading(null)
    }
  }

  // DM チャンネルではメンバー管理を表示しない
  if (channelType === "dm") return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="メンバー管理"
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>グループチャットメンバー</DialogTitle>
          <DialogDescription>
            メンバーの追加・削除ができます
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          {/* 招待リンク */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 px-1">
              招待リンク
            </h4>
            {inviteLink ? (
              <div className="flex gap-2 px-1">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 rounded-md border bg-muted px-3 py-1.5 text-sm select-all min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInvite}
                  className="shrink-0"
                >
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              </div>
            ) : (
              <div className="px-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "生成中..." : "招待リンクを生成"}
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              読み込み中...
            </p>
          ) : (
            <>
              {/* 現在のメンバー */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 px-1">
                  メンバー ({channelMembers.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {channelMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {member.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {member.displayName || "不明"}
                          {member.id === currentUserId && (
                            <span className="text-xs text-muted-foreground ml-1">(自分)</span>
                          )}
                        </div>
                      </div>
                      {member.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(member.id)}
                          disabled={actionLoading === member.id}
                        >
                          {actionLoading === member.id ? "..." : "削除"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 追加可能なメンバー */}
              {nonMembers.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 px-1">
                    追加可能なメンバー
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {nonMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {member.displayName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {member.displayName || "不明"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleAdd(member.id)}
                          disabled={actionLoading === member.id}
                        >
                          {actionLoading === member.id ? "..." : "追加"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
