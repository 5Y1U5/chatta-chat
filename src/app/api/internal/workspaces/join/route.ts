import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// 招待コードでワークスペースに参加
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

    // 招待コードでワークスペースを検索
    const workspace = await prisma.workspace.findUnique({
      where: { inviteCode },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: "無効な招待コードです" },
        { status: 404 }
      )
    }

    // 既にメンバーか確認
    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: auth.userId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({
        workspaceId: workspace.id,
        already: true,
      })
    }

    // ワークスペースメンバーに追加
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: auth.userId,
        role: "member",
      },
    })

    // 全 public チャンネルに自動参加
    const publicChannels = await prisma.channel.findMany({
      where: {
        workspaceId: workspace.id,
        type: "public",
      },
      select: { id: true },
    })

    if (publicChannels.length > 0) {
      await prisma.channelMember.createMany({
        data: publicChannels.map((ch) => ({
          channelId: ch.id,
          userId: auth.userId,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({
      workspaceId: workspace.id,
      already: false,
    })
  } catch (error) {
    console.error("ワークスペース参加エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
