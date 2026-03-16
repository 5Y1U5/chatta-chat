import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// タスク並び替え（一括 sortOrder 更新）
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { taskIds } = await request.json()

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    // 全タスクがワークスペースに属しているか確認
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, workspaceId: auth.workspaceId },
      select: { id: true },
    })

    if (tasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: "一部のタスクが見つかりません" },
        { status: 404 }
      )
    }

    // 順番どおりに sortOrder を更新
    await Promise.all(
      taskIds.map((id: string, index: number) =>
        prisma.task.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("タスク並び替えエラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
