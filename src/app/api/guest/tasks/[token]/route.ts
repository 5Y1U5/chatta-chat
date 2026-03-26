import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"

// ゲスト用タスク情報取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const prisma = getPrisma()

    // トークン検証
    const shareLink = await prisma.taskShareLink.findUnique({
      where: { token },
    })

    if (!shareLink || !shareLink.active) {
      return NextResponse.json(
        { error: "この共有リンクは無効です" },
        { status: 404 }
      )
    }

    // 有効期限チェック（将来用）
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json(
        { error: "この共有リンクは有効期限切れです" },
        { status: 410 }
      )
    }

    // タスク情報取得（内部IDは返さない）
    const task = await prisma.task.findUnique({
      where: { id: shareLink.taskId },
      include: {
        assignee: { select: { displayName: true, avatarUrl: true } },
        creator: { select: { displayName: true } },
        project: { select: { name: true, color: true } },
        comments: {
          include: { user: { select: { displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
        guestComments: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    // コメントを時系列マージ（内部IDは除外）
    const mergedComments = [
      ...task.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        displayName: c.user.displayName,
        avatarUrl: c.user.avatarUrl,
        isGuest: false as const,
      })),
      ...task.guestComments.map((gc) => ({
        id: gc.id,
        content: gc.content,
        createdAt: gc.createdAt.toISOString(),
        displayName: gc.guestName,
        avatarUrl: null,
        isGuest: true as const,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return NextResponse.json({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() || null,
      assigneeName: task.assignee?.displayName || null,
      creatorName: task.creator.displayName,
      projectName: task.project?.name || null,
      projectColor: task.project?.color || null,
      comments: mergedComments,
      shareLinkId: shareLink.id,
    })
  } catch (error) {
    console.error("ゲストタスク取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラー" },
      { status: 500 }
    )
  }
}
