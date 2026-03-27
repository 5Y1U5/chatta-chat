"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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

export function ProfileDialog() {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [linkingGoogle, setLinkingGoogle] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    setSaved(false)
    fetch("/api/internal/profile")
      .then((res) => res.json())
      .then((data) => {
        setDisplayName(data.displayName || "")
        setEmail(data.email || "")
      })
    // Google連携状態を確認
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const identities = data.user?.identities || []
      setGoogleLinked(identities.some((i) => i.provider === "google"))
    })
  }, [open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/internal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      })

      if (res.ok) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setOpen(false), 500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="プロフィール"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>プロフィール設定</DialogTitle>
            <DialogDescription>
              表示名を変更できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" value={email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Google アカウント連携</Label>
              {googleLinked ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Google アカウントと連携済み
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={linkingGoogle}
                  onClick={async () => {
                    setLinkingGoogle(true)
                    const supabase = createClient()
                    await supabase.auth.linkIdentity({
                      provider: "google",
                      options: {
                        redirectTo: `${window.location.origin}/api/auth/callback`,
                      },
                    })
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {linkingGoogle ? "連携中..." : "Google アカウントを連携する"}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            {saved && (
              <span className="text-sm text-green-600 mr-auto">保存しました</span>
            )}
            <Button type="submit" disabled={!displayName.trim() || loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
