import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

type TaskForAuth = {
  id: string
  workspaceId: string
  projectId: string | null
  creatorId: string
  assigneeId: string | null
}

// 各タスクに対して操作権限があるかをまとめて判定する
// 権限基準は単一タスク API（PATCH/DELETE）と同じ:
//   - プロジェクト所属タスク → ProjectMember
//   - プロジェクト未所属タスク → creator / assignee / TaskMember
async function authorizeTasks(
  prisma: ReturnType<typeof getPrisma>,
  userId: string,
  workspaceId: string,
  taskIds: string[]
): Promise<{ authorized: TaskForAuth[]; error?: { status: number; message: string } }> {
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, workspaceId },
    select: { id: true, workspaceId: true, projectId: true, creatorId: true, assigneeId: true },
  })

  if (tasks.length !== taskIds.length) {
    return {
      authorized: [],
      error: { status: 404, message: "一部のタスクが見つかりません" },
    }
  }

  // プロジェクト所属タスクと、未所属タスクで分岐して権限を一括取得
  const projectIds = Array.from(
    new Set(tasks.map((t) => t.projectId).filter((id): id is string => !!id))
  )
  const taskMemberCheckIds = tasks
    .filter((t) => !t.projectId && t.creatorId !== userId && t.assigneeId !== userId)
    .map((t) => t.id)

  const [projectMemberships, taskMemberships] = await Promise.all([
    projectIds.length > 0
      ? prisma.projectMember.findMany({
          where: { userId, projectId: { in: projectIds } },
          select: { projectId: true },
        })
      : Promise.resolve([]),
    taskMemberCheckIds.length > 0
      ? prisma.taskMember.findMany({
          where: { userId, taskId: { in: taskMemberCheckIds } },
          select: { taskId: true },
        })
      : Promise.resolve([]),
  ])

  const allowedProjectIds = new Set(projectMemberships.map((m) => m.projectId))
  const allowedTaskMemberIds = new Set(taskMemberships.map((m) => m.taskId))

  for (const t of tasks) {
    if (t.projectId) {
      if (!allowedProjectIds.has(t.projectId)) {
        return {
          authorized: [],
          error: { status: 403, message: "一部のタスクへのアクセス権がありません" },
        }
      }
    } else {
      const isOwner = t.creatorId === userId || t.assigneeId === userId
      if (!isOwner && !allowedTaskMemberIds.has(t.id)) {
        return {
          authorized: [],
          error: { status: 403, message: "一部のタスクへのアクセス権がありません" },
        }
      }
    }
  }

  return { authorized: tasks }
}

// 一括処理: アーカイブ / アーカイブ解除
//   POST { taskIds: string[], action: "archive" | "unarchive" }
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskIds, action } = await request.json()

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "taskIds は必須です" }, { status: 400 })
    }
    if (action !== "archive" && action !== "unarchive") {
      return NextResponse.json({ error: "action は archive / unarchive のいずれかです" }, { status: 400 })
    }

    const prisma = getPrisma()
    const { error } = await authorizeTasks(prisma, auth.userId, auth.workspaceId, taskIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    await prisma.task.updateMany({
      where: { id: { in: taskIds }, workspaceId: auth.workspaceId },
      data: { archived: action === "archive" },
    })

    return NextResponse.json({ success: true, count: taskIds.length })
  } catch (error) {
    console.error("タスク一括アーカイブエラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// 一括削除
//   DELETE ?taskIds=id1,id2,id3
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)
    const raw = searchParams.get("taskIds") || ""
    const taskIds = raw.split(",").map((s) => s.trim()).filter(Boolean)

    if (taskIds.length === 0) {
      return NextResponse.json({ error: "taskIds は必須です" }, { status: 400 })
    }

    const prisma = getPrisma()
    const { error } = await authorizeTasks(prisma, auth.userId, auth.workspaceId, taskIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    // Cascade でサブタスク・コメント等も削除される
    await prisma.task.deleteMany({
      where: { id: { in: taskIds }, workspaceId: auth.workspaceId },
    })

    return NextResponse.json({ success: true, count: taskIds.length })
  } catch (error) {
    console.error("タスク一括削除エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
