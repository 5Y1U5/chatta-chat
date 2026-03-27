import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const userSelect = { id: true, displayName: true, avatarUrl: true } as const

// タスクメンバー一覧
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()
    const taskId = request.nextUrl.searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "タスクIDは必須です" }, { status: 400 })
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    const members = await prisma.taskMember.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(members.map((m) => ({
      ...m.user,
      id: m.id,
      userId: m.userId,
    })))
  } catch (error) {
    console.error("タスクメンバー取得エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// タスクメンバー追加
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskId, userId } = await request.json()

    if (!taskId || !userId) {
      return NextResponse.json({ error: "タスクIDとユーザーIDは必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    // ワークスペースメンバーか確認
    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: auth.workspaceId, userId } },
    })
    if (!wsMember) {
      return NextResponse.json({ error: "ユーザーがワークスペースに所属していません" }, { status: 400 })
    }

    // 既に追加済みか確認
    const existing = await prisma.taskMember.findUnique({
      where: { taskId_userId: { taskId, userId } },
    })
    if (existing) {
      return NextResponse.json({ error: "既にメンバーです" }, { status: 409 })
    }

    await prisma.taskMember.create({
      data: { taskId, userId },
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
          type: "task_collaborator",
          title: `${actor?.displayName || "メンバー"}があなたをタスク「${task.title}」のコラボレーターに追加しました`,
          taskId,
          projectId: task.projectId,
          actorId: auth.userId,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("タスクメンバー追加エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// タスクメンバー削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const taskId = request.nextUrl.searchParams.get("taskId")
    const userId = request.nextUrl.searchParams.get("userId")

    if (!taskId || !userId) {
      return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 })
    }

    const prisma = getPrisma()

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    // 自分を削除: 常にOK。他者を削除: creator / assignee のみ
    if (userId !== auth.userId) {
      if (task.creatorId !== auth.userId && task.assigneeId !== auth.userId) {
        return NextResponse.json({ error: "タスクの作成者または担当者のみがメンバーを削除できます" }, { status: 403 })
      }
    }

    await prisma.taskMember.deleteMany({
      where: { taskId, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("タスクメンバー削除エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
