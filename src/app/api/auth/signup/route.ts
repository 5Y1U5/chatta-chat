import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"

// サインアップ後に DB ユーザー + ワークスペース + #general チャンネルを作成
export async function POST(request: Request) {
  try {
    const { supabaseUserId, email, displayName } = await request.json()

    if (!supabaseUserId || !email) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 既存ユーザーチェック
    const existing = await prisma.user.findUnique({
      where: { supabaseUserId },
    })
    if (existing) {
      return NextResponse.json(
        { error: "すでに登録済みです" },
        { status: 409 }
      )
    }

    // User 作成
    const user = await prisma.user.create({
      data: {
        supabaseUserId,
        email,
        displayName: displayName || email.split("@")[0],
      },
    })

    // Workspace 作成
    const workspace = await prisma.workspace.create({
      data: {
        name: `${displayName || email.split("@")[0]}のワークスペース`,
      },
    })

    // WorkspaceMember 作成
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "admin",
      },
    })

    // #general チャンネルを自動作成
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

    return NextResponse.json({
      userId: user.id,
      workspaceId: workspace.id,
    })
  } catch (error) {
    console.error("サインアップエラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
