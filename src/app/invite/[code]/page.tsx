"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { use } from "react"

type PageProps = {
  params: Promise<{ code: string }>
}

export default function InvitePage({ params }: PageProps) {
  const { code } = use(params)
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const router = useRouter()

  // セッション確認
  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
      setStatus("ready")
    }
    checkSession()
  }, [])

  async function handleJoin() {
    setStatus("joining")
    try {
      const res = await fetch("/api/internal/workspaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error || "参加に失敗しました")
        setStatus("error")
        return
      }

      const { workspaceId } = await res.json()
      setStatus("done")
      router.push(`/${workspaceId}`)
      router.refresh()
    } catch {
      setErrorMsg("参加に失敗しました")
      setStatus("error")
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">ワークスペースへの招待</CardTitle>
            <CardDescription>
              招待リンクからワークスペースに参加します
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "error" && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            {status === "done" && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">
                ワークスペースに参加しました。リダイレクトしています...
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {isLoggedIn ? (
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={status === "joining" || status === "done"}
              >
                {status === "joining" ? "参加中..." : "ワークスペースに参加する"}
              </Button>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  参加するにはアカウントが必要です
                </p>
                <div className="flex w-full gap-2">
                  <Button asChild className="flex-1">
                    <Link href={`/signup?invite=${code}`}>
                      新規登録
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/login?invite=${code}`}>
                      ログイン
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
