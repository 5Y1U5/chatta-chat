import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// グループチャットメンバー一覧取得
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // グループチャットが自分のワークスペースに属するか確認
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId: auth.workspaceId },
    })

    if (!channel) {
      return NextResponse.json(
        { error: "グループチャットが見つかりません" },
        { status: 404 }
      )
    }

    const members = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    })

    return NextResponse.json(
      members.map((m) => ({
        id: m.user.id,
        displayName: m.user.displayName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      }))
    )
  } catch (error) {
    console.error("グループチャットメンバー取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// グループチャットにメンバー追加
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId, userId } = await request.json()

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "channelId と userId は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // グループチャットが自分のワークスペースに属するか確認
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId: auth.workspaceId },
    })

    if (!channel) {
      return NextResponse.json(
        { error: "グループチャットが見つかりません" },
        { status: 404 }
      )
    }

    // マイチャットへのメンバー追加を拒否
    if (channel.name === "マイチャット" || channel.name === "general") {
      return NextResponse.json(
        { error: "マイチャットにはメンバーを追加できません" },
        { status: 400 }
      )
    }

    // 追加対象がワークスペースメンバーか確認
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: auth.workspaceId,
          userId,
        },
      },
    })

    if (!workspaceMember) {
      return NextResponse.json(
        { error: "ワークスペースメンバーではありません" },
        { status: 400 }
      )
    }

    await prisma.channelMember.create({
      data: { channelId, userId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("グループチャットメンバー追加エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// グループチャットからメンバー削除
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId, userId } = await request.json()

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "channelId と userId は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // グループチャットが自分のワークスペースに属するか確認
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId: auth.workspaceId },
    })

    if (!channel) {
      return NextResponse.json(
        { error: "グループチャットが見つかりません" },
        { status: 404 }
      )
    }

    await prisma.channelMember.deleteMany({
      where: { channelId, userId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("グループチャットメンバー削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
