import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// 招待コードでチャンネルに参加（ワークスペース未参加なら自動参加）
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { inviteCode } = await request.json()

    if (!inviteCode) {
      return NextResponse.json(
        { error: "招待コードは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 招待コードでチャンネルを検索
    const channel = await prisma.channel.findUnique({
      where: { inviteCode },
      include: { workspace: true },
    })

    if (!channel) {
      return NextResponse.json(
        { error: "無効な招待コードです" },
        { status: 404 }
      )
    }

    // ワークスペースに未参加なら自動参加
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: auth.userId,
        },
      },
    })

    if (!workspaceMember) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: channel.workspaceId,
          userId: auth.userId,
          role: "member",
        },
      })
    }

    // 既にチャンネルメンバーか確認
    const existingMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: channel.id,
          userId: auth.userId,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json({
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        already: true,
      })
    }

    // チャンネルメンバーに追加
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId: auth.userId,
      },
    })

    return NextResponse.json({
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      already: false,
    })
  } catch (error) {
    console.error("チャンネル参加エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
