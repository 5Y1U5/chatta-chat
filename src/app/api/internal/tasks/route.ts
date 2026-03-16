import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { getNextOccurrence } from "@/lib/recurrence"

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const

const taskInclude = {
  assignee: { select: userSelect },
  creator: { select: userSelect },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { subTasks: true, comments: true, members: true } },
} as const

// タスク一覧取得
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()
    const params = request.nextUrl.searchParams

    const projectId = params.get("projectId")
    const assigneeId = params.get("assigneeId")
    const parentTaskId = params.get("parentTaskId")
    const status = params.get("status")

    const where: Record<string, unknown> = {
      workspaceId: auth.workspaceId,
    }

    // デフォルトはルートタスクのみ（サブタスクを除外）
    // parentTaskId を明示的に指定した場合はそのサブタスクを取得
    if (parentTaskId) {
      where.parentTaskId = parentTaskId
    } else if (!params.has("parentTaskId")) {
      where.parentTaskId = null
    }

    if (projectId) where.projectId = projectId
    if (assigneeId) where.assigneeId = assigneeId
    if (status) where.status = status

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("タスク一覧取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// タスク作成
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const {
      title,
      description,
      projectId,
      parentTaskId,
      assigneeId,
      priority,
      dueDate,
      recurrenceRule,
      fileUrl,
      fileName,
      fileType,
    } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "タスク名は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // プロジェクトの所属確認
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })
      if (!project || project.workspaceId !== auth.workspaceId) {
        return NextResponse.json(
          { error: "プロジェクトが見つかりません" },
          { status: 404 }
        )
      }
    }

    // 担当者の所属確認
    if (assigneeId) {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: auth.workspaceId,
            userId: assigneeId,
          },
        },
      })
      if (!member) {
        return NextResponse.json(
          { error: "担当者がワークスペースに所属していません" },
          { status: 400 }
        )
      }
    }

    // サブタスクの場合、上限チェック（各階層最大15個）
    if (parentTaskId) {
      const siblingCount = await prisma.task.count({
        where: { parentTaskId },
      })
      if (siblingCount >= 15) {
        return NextResponse.json(
          { error: "サブタスクは最大15個までです" },
          { status: 400 }
        )
      }

      // ネスト深度チェック（最大2階層まで: タスク → サブタスク → サブサブタスク）
      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { parentTaskId: true },
      })
      if (parentTask?.parentTaskId) {
        // 親がサブタスク → 祖父母を確認
        const grandparent = await prisma.task.findUnique({
          where: { id: parentTask.parentTaskId },
          select: { parentTaskId: true },
        })
        if (grandparent?.parentTaskId) {
          return NextResponse.json(
            { error: "サブタスクは2階層までです" },
            { status: 400 }
          )
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        workspaceId: auth.workspaceId,
        title: title.trim(),
        description: description?.trim() || null,
        projectId: projectId || null,
        parentTaskId: parentTaskId || null,
        assigneeId: assigneeId || null,
        creatorId: auth.userId,
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        recurrenceRule: recurrenceRule || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
      },
      include: taskInclude,
    })

    // 担当者に通知（自分以外の場合）
    if (assigneeId && assigneeId !== auth.userId) {
      const creator = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { displayName: true },
      })
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: "task_assigned",
          title: `${creator?.displayName || "メンバー"}があなたにタスク「${title.trim()}」を割り当てました`,
          taskId: task.id,
          projectId: projectId || null,
          actorId: auth.userId,
        },
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("タスク作成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// タスク更新
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await request.json()
    const { taskId, ...updates } = body

    if (!taskId) {
      return NextResponse.json(
        { error: "タスクIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = {}

    if (updates.title !== undefined) data.title = updates.title.trim()
    if (updates.description !== undefined)
      data.description = updates.description?.trim() || null
    if (updates.projectId !== undefined)
      data.projectId = updates.projectId || null
    if (updates.assigneeId !== undefined)
      data.assigneeId = updates.assigneeId || null
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.dueDate !== undefined)
      data.dueDate = updates.dueDate ? new Date(updates.dueDate) : null
    if (updates.recurrenceRule !== undefined)
      data.recurrenceRule = updates.recurrenceRule || null
    if (updates.sortOrder !== undefined) data.sortOrder = updates.sortOrder
    if (updates.fileUrl !== undefined) data.fileUrl = updates.fileUrl || null
    if (updates.fileName !== undefined) data.fileName = updates.fileName || null
    if (updates.fileType !== undefined) data.fileType = updates.fileType || null

    // ステータス変更のハンドリング
    if (updates.status !== undefined) {
      data.status = updates.status
      if (updates.status === "done") {
        data.completedAt = new Date()

        // 繰り返しタスクの場合、次回タスクを自動生成
        if (task.recurrenceRule) {
          const nextDate = getNextOccurrence(task.recurrenceRule, new Date())
          if (nextDate) {
            await prisma.task.create({
              data: {
                workspaceId: task.workspaceId,
                title: task.title,
                description: task.description,
                projectId: task.projectId,
                assigneeId: task.assigneeId,
                creatorId: task.creatorId,
                priority: task.priority,
                dueDate: nextDate,
                recurrenceRule: task.recurrenceRule,
                nextOccurrence: nextDate,
              },
            })
          }
        }

        // 作成者に完了通知（自分以外の場合）
        if (task.creatorId !== auth.userId) {
          const actor = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: { displayName: true },
          })
          await prisma.notification.create({
            data: {
              userId: task.creatorId,
              type: "task_completed",
              title: `${actor?.displayName || "メンバー"}がタスク「${task.title}」を完了しました`,
              taskId: task.id,
              projectId: task.projectId,
              actorId: auth.userId,
            },
          })
        }
      } else {
        data.completedAt = null
      }
    }

    // 担当者変更の通知
    if (
      updates.assigneeId !== undefined &&
      updates.assigneeId !== task.assigneeId &&
      updates.assigneeId &&
      updates.assigneeId !== auth.userId
    ) {
      const actor = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { displayName: true },
      })
      await prisma.notification.create({
        data: {
          userId: updates.assigneeId,
          type: "task_assigned",
          title: `${actor?.displayName || "メンバー"}があなたにタスク「${task.title}」を割り当てました`,
          taskId: task.id,
          projectId: task.projectId,
          actorId: auth.userId,
        },
      })
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
      include: taskInclude,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("タスク更新エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// タスク削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const taskId = request.nextUrl.searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json(
        { error: "タスクIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    // Cascade でサブタスク・コメントも削除される
    await prisma.task.delete({ where: { id: taskId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("タスク削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
