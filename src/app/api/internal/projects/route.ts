import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

// プロジェクト一覧取得
export async function GET() {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()

    const projects = await prisma.project.findMany({
      where: { workspaceId: auth.workspaceId, archived: false },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("プロジェクト一覧取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// プロジェクト作成
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const { name, description, color } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "プロジェクト名は必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const project = await prisma.project.create({
      data: {
        workspaceId: auth.workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
      },
    })

    return NextResponse.json({ id: project.id })
  } catch (error) {
    console.error("プロジェクト作成エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// プロジェクト更新
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { projectId, name, description, color, archived } =
      await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: "プロジェクトIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project || project.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      )
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(color !== undefined && { color }),
        ...(archived !== undefined && { archived }),
      },
    })

    return NextResponse.json({ id: updated.id, name: updated.name })
  } catch (error) {
    console.error("プロジェクト更新エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// プロジェクト削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const projectId = request.nextUrl.searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json(
        { error: "プロジェクトIDは必須です" },
        { status: 400 }
      )
    }

    const prisma = getPrisma()

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project || project.workspaceId !== auth.workspaceId) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      )
    }

    // プロジェクト内タスクの projectId を null にしてからプロジェクト削除
    await prisma.task.updateMany({
      where: { projectId },
      data: { projectId: null },
    })

    await prisma.project.delete({ where: { id: projectId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("プロジェクト削除エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
