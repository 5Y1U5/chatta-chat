import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// チャンネル作成
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { name, type = "public" } = await request.json()

    if (!name?.trim() && type !== "dm") {
      return NextResponse.json(
        { error: "チャンネル名は必須です" },
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
    console.error("チャンネル作成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
