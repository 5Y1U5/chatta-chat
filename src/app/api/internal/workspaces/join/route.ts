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

    // 新メンバー用のマイチャットを作成（個人専用・非共有）
    const myChat = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        name: "マイチャット",
        type: "public",
      },
    })
    await prisma.channelMember.create({
      data: {
        channelId: myChat.id,
        userId: auth.userId,
      },
    })

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
