import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "chat-files"

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const

// 添付ファイルレコード作成（ファイル本体は先に /api/internal/upload でアップロード済み）
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskId, fileUrl, fileName, fileType, fileSize } = await request.json()

    if (!taskId || !fileUrl || !fileName || !fileType || typeof fileSize !== "number") {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        uploaderId: auth.userId,
      },
      include: { uploader: { select: userSelect } },
    })

    return NextResponse.json(attachment)
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    console.error("タスク添付ファイル作成エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

// 添付ファイル削除（Storage からも削除）
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const attachmentId = request.nextUrl.searchParams.get("id")

    if (!attachmentId) {
      return NextResponse.json({ error: "添付ファイルIDは必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: { select: { id: true, workspaceId: true, creatorId: true } } },
    })

    if (!attachment || attachment.task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "添付ファイルが見つかりません" }, { status: 404 })
    }

    // アップロード本人 or タスク作成者のみ削除可
    if (attachment.uploaderId !== auth.userId && attachment.task.creatorId !== auth.userId) {
      return NextResponse.json({ error: "削除する権限がありません" }, { status: 403 })
    }

    // Storage からファイル削除（fileUrl から path を逆引き）
    // 形式: .../storage/v1/object/public/chat-files/<userId>/<ts-uuid>.<ext>
    try {
      const marker = `/object/public/${BUCKET_NAME}/`
      const idx = attachment.fileUrl.indexOf(marker)
      if (idx >= 0) {
        const path = decodeURIComponent(attachment.fileUrl.slice(idx + marker.length))
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await supabase.storage.from(BUCKET_NAME).remove([path])
      }
    } catch (storageError) {
      // Storage 削除失敗は DB 削除を妨げない（ログのみ）
      console.error("Storage ファイル削除エラー:", storageError)
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    console.error("タスク添付ファイル削除エラー:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
