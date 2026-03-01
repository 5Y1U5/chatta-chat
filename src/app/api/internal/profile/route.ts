import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// プロフィール取得
export async function GET() {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { displayName: true, email: true, avatarUrl: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("プロフィール取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// プロフィール更新
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { displayName } = await request.json()

    if (!displayName?.trim()) {
      return NextResponse.json(
        { error: "表示名は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    await prisma.user.update({
      where: { id: auth.userId },
      data: { displayName: displayName.trim() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("プロフィール更新エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
