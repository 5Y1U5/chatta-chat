import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// ワークスペースメンバー一覧
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()
    const includeSelf = request.nextUrl.searchParams.get("includeSelf") === "true"

    const where: Record<string, unknown> = {
      workspaceId: auth.workspaceId,
    }
    if (!includeSelf) {
      where.userId = { not: auth.userId }
    }

    const members = await prisma.workspaceMember.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "asc" },
    })

    const result = members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      email: m.user.email,
      role: m.role,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("メンバー一覧エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
