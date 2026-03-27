import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// プロジェクトに招待コードで参加
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { inviteCode } = await request.json()

    if (!inviteCode) {
      return NextResponse.json({ error: "招待コードは必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    const project = await prisma.project.findUnique({
      where: { inviteCode },
      include: { workspace: true },
    })
    if (!project) {
      return NextResponse.json({ error: "無効な招待コードです" }, { status: 404 })
    }

    // ワークスペースメンバーか確認
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: auth.userId } },
    })
    if (!workspaceMember) {
      return NextResponse.json({ error: "このワークスペースのメンバーではありません" }, { status: 403 })
    }

    // 既にプロジェクトメンバーか確認
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: auth.userId } },
    })
    if (existing) {
      return NextResponse.json({ projectId: project.id, workspaceId: project.workspaceId, alreadyMember: true })
    }

    // プロジェクトメンバーに追加
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: auth.userId,
        role: "member",
      },
    })

    return NextResponse.json({ projectId: project.id, workspaceId: project.workspaceId })
  } catch (error) {
    console.error("プロジェクト参加エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
