import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// 招待コード生成/取得
export async function POST() {
  try {
    const auth = await requireAuth()

    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "管理者のみ招待リンクを生成できます" },
        { status: 403 }
      )
    }

    const prisma = getPrisma()

    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      )
    }

    let inviteCode = workspace.inviteCode

    // 招待コードがなければ生成
    if (!inviteCode) {
      inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 12)

      await prisma.workspace.update({
        where: { id: auth.workspaceId },
        data: { inviteCode },
      })
    }

    return NextResponse.json({
      inviteCode,
      workspaceName: workspace.name,
    })
  } catch (error) {
    console.error("招待コード生成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
