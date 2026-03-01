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

export function SignupForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get("invite")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== passwordConfirm) {
      setError("パスワードが一致しません")
      return
    }

    setLoading(true)

    try {
      // 1. Supabase Auth でユーザー作成
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (!authData.user) {
        setError("ユーザー作成に失敗しました")
        return
      }

      // 2. DB にユーザー + ワークスペースを作成（招待コード付きなら既存ワークスペースに参加）
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUserId: authData.user.id,
          email,
          displayName,
          ...(inviteCode && { inviteCode }),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "登録に失敗しました")
        return
      }

      router.push("/")
      router.refresh()
    } catch {
      setError("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">新規登録</CardTitle>
        <CardDescription>
          アカウントを作成してチャットを始めましょう
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
            <Label htmlFor="displayName">表示名</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="あなたの名前"
              required
            />
          </div>
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
              placeholder="8文字以上"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">パスワード（確認）</Label>
            <Input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="もう一度入力"
              minLength={8}
              required
            />
            {passwordConfirm && (
              <p className={`text-xs ${password === passwordConfirm ? "text-green-600" : "text-destructive"}`}>
                {password === passwordConfirm ? "パスワードが一致しています" : "パスワードが一致しません"}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登録中..." : "アカウント作成"}
          </Button>
          <div className="flex w-full items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">または</span>
            <Separator className="flex-1" />
          </div>
          <GoogleLoginButton next={inviteCode ? `/invite/${inviteCode}` : undefined} />
          <p className="text-sm text-muted-foreground">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-primary hover:underline">
              ログイン
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
