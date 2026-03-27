import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// プロジェクト招待コード生成/取得
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { projectId } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: "projectId は必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    // プロジェクトメンバーか確認
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: auth.userId } },
    })
    if (!membership) {
      return NextResponse.json({ error: "プロジェクトメンバーではありません" }, { status: 403 })
    }

    // 既存の招待コードがあればそれを返す、なければ生成
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 })
    }

    let inviteCode = project.inviteCode
    if (!inviteCode) {
      inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      await prisma.project.update({
        where: { id: projectId },
        data: { inviteCode },
      })
    }

    return NextResponse.json({ inviteCode })
  } catch (error) {
    console.error("プロジェクト招待コード生成エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
