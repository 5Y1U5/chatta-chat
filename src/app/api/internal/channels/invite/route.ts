import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// グループチャット招待コード生成/取得
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { channelId } = await request.json()

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

    let inviteCode = channel.inviteCode

    // 招待コードがなければ生成
    if (!inviteCode) {
      inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 12)

      await prisma.channel.update({
        where: { id: channelId },
        data: { inviteCode },
      })
    }

    return NextResponse.json({
      inviteCode,
      channelName: channel.name,
    })
  } catch (error) {
    console.error("グループチャット招待コード生成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
