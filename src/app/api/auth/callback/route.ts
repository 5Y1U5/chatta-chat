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
          // 招待リンク経由の場合、inviteCode を抽出
          let inviteCode: string | undefined
          let channelInviteCode: string | undefined
          if (next.startsWith("/invite/")) {
            inviteCode = next.replace("/invite/", "")
          } else if (next.startsWith("/ch/")) {
            channelInviteCode = next.replace("/ch/", "")
          }

          await ensureDbUser(user.id, user.email || "", user.user_metadata?.full_name || user.user_metadata?.name, inviteCode, channelInviteCode)
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
// inviteCode がある場合は既存ワークスペースに参加
async function ensureDbUser(supabaseUserId: string, email: string, displayName?: string, inviteCode?: string, channelInviteCode?: string) {
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

  // 招待コードがある場合は既存ワークスペースに参加
  if (inviteCode) {
    const invitedWorkspace = await prisma.workspace.findUnique({
      where: { inviteCode },
    })

    if (invitedWorkspace) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: invitedWorkspace.id,
          userId: user.id,
          role: "member",
        },
      })

      const publicChannels = await prisma.channel.findMany({
        where: { workspaceId: invitedWorkspace.id, type: "public" },
        select: { id: true },
      })

      if (publicChannels.length > 0) {
        await prisma.channelMember.createMany({
          data: publicChannels.map((ch) => ({
            channelId: ch.id,
            userId: user.id,
          })),
          skipDuplicates: true,
        })
      }

      return
    }
  }

  // チャンネル招待コードがある場合はワークスペース + チャンネルに参加
  if (channelInviteCode) {
    const channel = await prisma.channel.findUnique({
      where: { inviteCode: channelInviteCode },
    })

    if (channel) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: channel.workspaceId,
          userId: user.id,
          role: "member",
        },
      })

      await prisma.channelMember.create({
        data: {
          channelId: channel.id,
          userId: user.id,
        },
      })

      return
    }
  }

  // 招待コードなし or 無効 → 自分のワークスペースを作成
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
