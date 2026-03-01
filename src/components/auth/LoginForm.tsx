"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get("invite")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError("メールアドレスまたはパスワードが正しくありません")
        return
      }

      // 招待コード付きなら招待ページへ、なければトップへ
      router.push(inviteCode ? `/invite/${inviteCode}` : "/")
      router.refresh()
    } catch {
      setError("ログインに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">ログイン</CardTitle>
        <CardDescription>
          アカウントにログインしてください
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
          <div className="flex w-full items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">または</span>
            <Separator className="flex-1" />
          </div>
          <GoogleLoginButton next={inviteCode ? `/invite/${inviteCode}` : undefined} />
          <p className="text-sm text-muted-foreground">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-primary hover:underline">
              新規登録
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
