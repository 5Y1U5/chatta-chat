import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const actorSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const

// 通知一覧取得
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const prisma = getPrisma()

    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true"

    const notifications = await prisma.notification.findMany({
      where: {
        userId: auth.userId,
        archived: false,
        ...(unreadOnly && { read: false }),
      },
      include: { actor: { select: actorSelect } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // 未読数も一緒に返す
    const unreadCount = await prisma.notification.count({
      where: { userId: auth.userId, read: false, archived: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("通知一覧取得エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

// 通知を既読にする
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const { notificationId, markAllRead, archiveId } = await request.json()

    const prisma = getPrisma()

    // 単一通知をアーカイブ
    if (archiveId) {
      const notification = await prisma.notification.findUnique({ where: { id: archiveId } })
      if (!notification || notification.userId !== auth.userId) {
        return NextResponse.json({ error: "通知が見つかりません" }, { status: 404 })
      }
      await prisma.notification.update({
        where: { id: archiveId },
        data: { archived: true },
      })
      return NextResponse.json({ success: true })
    }

    if (markAllRead) {
      // 全て既読
      await prisma.notification.updateMany({
        where: { userId: auth.userId, read: false },
        data: { read: true },
      })
      return NextResponse.json({ success: true })
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "通知IDは必須です" },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification || notification.userId !== auth.userId) {
      return NextResponse.json(
        { error: "通知が見つかりません" },
        { status: 404 }
      )
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("通知既読エラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
