import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// チャンネルの重要事項メモリ一覧取得
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const channelId = request.nextUrl.searchParams.get("channelId")

    if (!channelId) {
      return NextResponse.json(
        { error: "チャンネルIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // チャンネルメンバーか確認
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: { channelId, userId: auth.userId },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "このグループチャットのメンバーではありません" },
        { status: 403 }
      )
    }

    const memories = await prisma.channelMemory.findMany({
      where: { channelId },
      orderBy: { detectedAt: "desc" },
      take: 50,
    })

    return NextResponse.json(memories)
  } catch (error) {
    console.error("メモリ取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// メモリ削除
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth()
    const memoryId = request.nextUrl.searchParams.get("memoryId")

    if (!memoryId) {
      return NextResponse.json(
        { error: "メモリIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()
    await prisma.channelMemory.delete({ where: { id: memoryId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("メモリ削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
