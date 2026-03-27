import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const

// タスクコメント一覧取得
export async function GET(request: NextRequest) {
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

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    const [comments, guestComments] = await Promise.all([
      prisma.taskComment.findMany({
        where: { taskId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.guestComment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
      }),
    ])

    // ゲストコメントを TaskCommentInfo 互換の形式に変換してマージ
    const merged = [
      ...comments.map((c) => ({ ...c, isGuest: false as const })),
      ...guestComments.map((gc) => ({
        id: gc.id,
        taskId: gc.taskId,
        content: gc.content,
        fileUrl: null,
        fileName: null,
        fileType: null,
        createdAt: gc.createdAt,
        user: {
          id: `guest-${gc.id}`,
          displayName: `${gc.guestName}（ゲスト）`,
          avatarUrl: null,
        },
        isGuest: true as const,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return NextResponse.json(merged)
  } catch (error) {
    console.error("タスクコメント取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// タスクコメント投稿
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskId, content, fileUrl, fileName, fileType } = await request.json()

    if (!taskId || (!content?.trim() && !fileUrl)) {
      return NextResponse.json(
        { error: "タスクIDとコメント内容またはファイルは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: auth.userId,
        content: content?.trim() || "",
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
      },
      include: { user: { select: userSelect } },
    })

    // タスクの担当者・作成者にコメント通知（自分以外）
    const notifyUserIds = new Set<string>()
    if (task.assigneeId && task.assigneeId !== auth.userId) {
      notifyUserIds.add(task.assigneeId)
    }
    if (task.creatorId !== auth.userId) {
      notifyUserIds.add(task.creatorId)
    }

    // メンション通知: @表示名 をパースして対象ユーザーに通知
    const mentionNames = [...content.trim().matchAll(/@(\S+)/g)].map((m) => m[1])
    const mentionedUserIds = new Set<string>()
    if (mentionNames.length > 0) {
      // displayName でマッチングする
      const mentionedUsers = await prisma.user.findMany({
        where: {
          displayName: { in: mentionNames },
          workspaceMembers: { some: { workspaceId: auth.workspaceId } },
        },
        select: { id: true },
      })
      for (const u of mentionedUsers) {
        if (u.id !== auth.userId) {
          mentionedUserIds.add(u.id)
        }
      }
    }

    const actor = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { displayName: true },
    })

    // コメント本文のプレビュー（100文字まで）
    const bodyPreview = content.length > 100 ? content.slice(0, 100) + "…" : content

    const notifications: Array<{
      userId: string
      type: string
      title: string
      body: string | null
      taskId: string
      projectId: string | null
      actorId: string
    }> = []

    // 通常のコメント通知（メンションされていないユーザーのみ）
    for (const userId of notifyUserIds) {
      if (!mentionedUserIds.has(userId)) {
        notifications.push({
          userId,
          type: "task_comment",
          title: `${actor?.displayName || "メンバー"}がタスク「${task.title}」にコメントしました`,
          body: bodyPreview,
          taskId: task.id,
          projectId: task.projectId,
          actorId: auth.userId,
        })
      }
    }

    // メンション通知
    for (const userId of mentionedUserIds) {
      notifications.push({
        userId,
        type: "task_mentioned",
        title: `${actor?.displayName || "メンバー"}がタスク「${task.title}」であなたをメンションしました`,
        body: bodyPreview,
        taskId: task.id,
        projectId: task.projectId,
        actorId: auth.userId,
      })
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications })
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error("タスクコメント投稿エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
