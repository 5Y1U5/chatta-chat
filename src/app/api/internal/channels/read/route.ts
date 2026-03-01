import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// チャンネル既読マーク
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

    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId: auth.userId,
        },
      },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("既読マークエラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
