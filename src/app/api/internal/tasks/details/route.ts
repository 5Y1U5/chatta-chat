import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const userSelect = { id: true, displayName: true, avatarUrl: true } as const

const taskInclude = {
  assignee: { select: userSelect },
  creator: { select: userSelect },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { subTasks: true, comments: true, members: true } },
} as const

// タスク詳細一括取得（サブタスク + コメント + メンバー + 共有リンク）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const taskId = request.nextUrl.searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "タスクIDは必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    // 全データを並列取得（1リクエスト = 1回の認証チェック + 並列DBクエリ）
    const [subTasks, comments, guestComments, members, shareLink, attachments] = await Promise.all([
      // サブタスク
      prisma.task.findMany({
        where: { parentTaskId: taskId, workspaceId: auth.workspaceId },
        include: taskInclude,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      // コメント
      prisma.taskComment.findMany({
        where: { taskId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
      // ゲストコメント
      prisma.guestComment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
      }),
      // メンバー
      prisma.taskMember.findMany({
        where: { taskId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
      // 共有リンク
      prisma.taskShareLink.findFirst({
        where: { taskId, active: true },
        select: { token: true },
      }),
      // 添付ファイル
      prisma.taskAttachment.findMany({
        where: { taskId },
        include: { uploader: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
    ])

    // コメントをマージ（ゲストコメントを TaskCommentInfo 互換に変換）
    const mergedComments = [
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

    // メンバーを整形
    const formattedMembers = members.map((m) => ({
      ...m.user,
      id: m.id,
      userId: m.userId,
    }))

    return NextResponse.json({
      subTasks,
      comments: mergedComments,
      members: formattedMembers,
      shareToken: shareLink?.token || null,
      attachments,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    console.error("タスク詳細一括取得エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
