import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { getPrisma } from "@/lib/prisma"

type AuthContext = {
  workspaceId: string
  userId: string
  supabaseUserId: string
  role: string
}

// Supabase Auth セッションから workspaceId / userId / role を取得
// 認証失敗時は null を返す
// React.cache() で同一レンダリングリクエスト内の結果をメモ化
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const prisma = getPrisma()
  const dbUser = await prisma.user.findUnique({
    where: { supabaseUserId: user.id },
    include: {
      workspaceMembers: {
        select: { workspaceId: true, role: true },
        take: 1,
      },
    },
  })

  if (!dbUser || dbUser.workspaceMembers.length === 0) return null

  const membership = dbUser.workspaceMembers[0]

  return {
    workspaceId: membership.workspaceId,
    userId: dbUser.id,
    supabaseUserId: dbUser.supabaseUserId,
    role: membership.role,
  }
})

// 認証必須のラッパー — 未認証なら例外を投げる
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) {
    throw new Error("認証が必要です")
  }
  return ctx
}
