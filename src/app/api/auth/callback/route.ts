import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPrisma } from "@/lib/prisma"

// Supabase Auth のコールバック（OAuth / メール確認後のリダイレクト）
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // OAuth ログインの場合、DB ユーザーが未作成なら作成する
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        try {
          await ensureDbUser(user.id, user.email || "", user.user_metadata?.full_name || user.user_metadata?.name)
        } catch (e) {
          console.error("DB ユーザー作成エラー:", e)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}

// DB ユーザーが存在しなければ作成（Google ログイン用）
async function ensureDbUser(supabaseUserId: string, email: string, displayName?: string) {
  const prisma = getPrisma()

  const existing = await prisma.user.findUnique({
    where: { supabaseUserId },
  })

  if (existing) return

  const name = displayName || email.split("@")[0]

  const user = await prisma.user.create({
    data: {
      supabaseUserId,
      email,
      displayName: name,
    },
  })

  const workspace = await prisma.workspace.create({
    data: {
      name: `${name}のワークスペース`,
    },
  })

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "admin",
    },
  })

  const generalChannel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      name: "general",
      type: "public",
    },
  })

  await prisma.channelMember.create({
    data: {
      channelId: generalChannel.id,
      userId: user.id,
    },
  })
}
