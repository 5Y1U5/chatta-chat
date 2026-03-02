import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// マイチャット判定（"general" は旧デフォルト名）
function isMyChat(name: string | null, type: string): boolean {
  return (name === "マイチャット" || name === "general") && type === "public"
}

// グループチャット作成
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { name, type = "public" } = await request.json()

    if (!name?.trim() && type !== "dm") {
      return NextResponse.json(
        { error: "グループチャット名は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const channel = await prisma.channel.create({
      data: {
        workspaceId: auth.workspaceId,
        name: name?.trim() || null,
        type,
      },
    })

    // 作成者をメンバーに追加
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId: auth.userId,
      },
    })

    return NextResponse.json({ id: channel.id })
  } catch (error) {
    console.error("グループチャット作成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// グループチャット名称変更
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId, name } = await request.json()

    if (!channelId || !name?.trim()) {
      return NextResponse.json(
        { error: "グループチャットIDと名前は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 対象チャンネルを取得して検証
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    })

    if (!channel || channel.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "グループチャットが見つかりません" },
        { status: 404 }
      )
    }

    if (isMyChat(channel.name, channel.type)) {
      return NextResponse.json(
        { error: "マイチャットの名前は変更できません" },
        { status: 403 }
      )
    }

    if (channel.type === "dm") {
      return NextResponse.json(
        { error: "DMの名前は変更できません" },
        { status: 403 }
      )
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { name: name.trim() },
    })

    return NextResponse.json({ id: updated.id, name: updated.name })
  } catch (error) {
    console.error("グループチャット名称変更エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// グループチャット削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const channelId = request.nextUrl.searchParams.get("channelId")

    if (!channelId) {
      return NextResponse.json(
        { error: "グループチャットIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 対象チャンネルを取得して検証
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    })

    if (!channel || channel.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "グループチャットが見つかりません" },
        { status: 404 }
      )
    }

    if (isMyChat(channel.name, channel.type)) {
      return NextResponse.json(
        { error: "マイチャットは削除できません" },
        { status: 403 }
      )
    }

    if (channel.type === "dm") {
      return NextResponse.json(
        { error: "DMは削除できません" },
        { status: 403 }
      )
    }

    // Cascade で ChannelMember・Message・Reaction も削除される
    await prisma.channel.delete({
      where: { id: channelId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("グループチャット削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
