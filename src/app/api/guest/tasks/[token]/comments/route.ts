import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"

// ゲストコメント投稿
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { guestName, content } = await request.json()

    // バリデーション
    if (!guestName?.trim() || guestName.trim().length > 50) {
      return NextResponse.json(
        { error: "名前は1〜50文字で入力してください" },
        { status: 400 }
      )
    }
    if (!content?.trim() || content.trim().length > 2000) {
      return NextResponse.json(
        { error: "コメントは1〜2000文字で入力してください" },
        { status: 400 }
      )
    }

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

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json(
        { error: "この共有リンクは有効期限切れです" },
        { status: 410 }
      )
    }

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id: shareLink.taskId },
      select: { id: true, title: true, assigneeId: true, creatorId: true },
    })

    if (!task) {
      return NextResponse.json(
        { error: "タスクが見つかりません" },
        { status: 404 }
      )
    }

    // ゲストコメント作成
    const comment = await prisma.guestComment.create({
      data: {
        taskId: task.id,
        shareLinkId: shareLink.id,
        guestName: guestName.trim(),
        content: content.trim(),
      },
    })

    // 担当者・作成者に通知
    const notifyUserIds = new Set<string>()
    if (task.assigneeId) notifyUserIds.add(task.assigneeId)
    if (task.creatorId) notifyUserIds.add(task.creatorId)

    if (notifyUserIds.size > 0) {
      // 共有リンク作成者を actorId として使用
      await prisma.notification.createMany({
        data: [...notifyUserIds].map((userId) => ({
          userId,
          type: "guest_comment",
          title: `${guestName.trim()}（ゲスト）がタスク「${task.title}」にコメントしました`,
          taskId: task.id,
          actorId: shareLink.createdBy,
        })),
      })
    }

    return NextResponse.json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      displayName: comment.guestName,
      avatarUrl: null,
      isGuest: true,
    })
  } catch (error) {
    console.error("ゲストコメント投稿エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラー" },
      { status: 500 }
    )
  }
}
