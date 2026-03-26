import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import crypto from "crypto"

// 既存の共有リンク取得
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const taskId = request.nextUrl.searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "taskId は必須です" }, { status: 400 })
    }

    const prisma = getPrisma()
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    const existing = await prisma.taskShareLink.findFirst({
      where: { taskId, active: true },
    })

    if (existing) {
      return NextResponse.json({ token: existing.token })
    }

    return NextResponse.json({ token: null })
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 })
  }
}

// 共有リンク生成
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "taskId は必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    // 既存の有効なリンクがあればそれを返す
    const existing = await prisma.taskShareLink.findFirst({
      where: { taskId, active: true },
    })

    if (existing) {
      return NextResponse.json({ token: existing.token })
    }

    // 新規作成（128bitランダムトークン）
    const token = crypto.randomBytes(16).toString("hex")
    await prisma.taskShareLink.create({
      data: {
        taskId,
        token,
        createdBy: auth.userId,
      },
    })

    return NextResponse.json({ token })
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    console.error("共有リンク生成エラー:", error)
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 })
  }
}

// 共有リンク無効化
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "taskId は必須です" }, { status: 400 })
    }

    const prisma = getPrisma()

    // タスクの所属確認
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 })
    }

    // 全ての有効なリンクを無効化
    await prisma.taskShareLink.updateMany({
      where: { taskId, active: true },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "認証が必要です") {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    console.error("共有リンク無効化エラー:", error)
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 })
  }
}
