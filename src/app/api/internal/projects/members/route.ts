import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const userSelect = { id: true, displayName: true, avatarUrl: true } as const

// プロジェクトメンバー一覧
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()
    const projectId = request.nextUrl.searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "プロジェクトIDは必須です" }, { status: 400 })
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 })
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      ...m.user,
    })))
  } catch (error) {
    console.error("プロジェクトメンバー取得エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// プロジェクトメンバー追加
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { projectId, userId } = await request.json()

    if (!projectId || !userId) {
      return NextResponse.json({ error: "プロジェクトIDとユーザーIDは必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 })
    }

    // ワークスペースメンバーか確認
    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: auth.workspaceId, userId } },
    })
    if (!wsMember) {
      return NextResponse.json({ error: "ユーザーがワークスペースに所属していません" }, { status: 400 })
    }

    // 既に追加済みか確認
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    if (existing) {
      return NextResponse.json({ error: "既にメンバーです" }, { status: 409 })
    }

    await prisma.projectMember.create({
      data: { projectId, userId },
    })

    // 通知
    if (userId !== auth.userId) {
      const actor = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { displayName: true },
      })
      await prisma.notification.create({
        data: {
          userId,
          type: "task_assigned",
          title: `${actor?.displayName || "メンバー"}がプロジェクト「${project.name}」に招待しました`,
          projectId,
          actorId: auth.userId,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("プロジェクトメンバー追加エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// プロジェクトメンバー削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const projectId = request.nextUrl.searchParams.get("projectId")
    const userId = request.nextUrl.searchParams.get("userId")

    if (!projectId || !userId) {
      return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 })
    }

    const prisma = getPrisma()

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 })
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("プロジェクトメンバー削除エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
