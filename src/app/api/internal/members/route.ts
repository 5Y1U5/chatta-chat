import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// ワークスペースメンバー一覧（自分以外）
export async function GET() {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: auth.workspaceId,
        userId: { not: auth.userId },
      },
      include: { user: true },
    })

    const result: { id: string; displayName: string | null; email: string }[] = []
    for (const m of members) {
      result.push({
        id: m.user.id,
        displayName: m.user.displayName,
        email: m.user.email,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("メンバー一覧エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
