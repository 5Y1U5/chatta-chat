import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { DashboardView } from "@/components/task/DashboardView"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const prisma = getPrisma()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 自分のタスク統計
  const [totalTasks, overdueTasks, dueTodayTasks, completedTodayTasks] =
    await Promise.all([
      prisma.task.count({
        where: {
          workspaceId,
          assigneeId: auth.userId,
          status: { not: "done" },
          parentTaskId: null,
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          assigneeId: auth.userId,
          status: { not: "done" },
          parentTaskId: null,
          dueDate: { lt: todayStart },
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          assigneeId: auth.userId,
          status: { not: "done" },
          parentTaskId: null,
          dueDate: {
            gte: todayStart,
            lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          assigneeId: auth.userId,
          completedAt: { gte: todayStart },
          parentTaskId: null,
        },
      }),
    ])

  // 直近の完了タスク（チーム全体）
  const recentCompletedTasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: "done",
      completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      parentTaskId: null,
    },
    include: {
      assignee: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 10,
  })

  // 期限間近のタスク
  const upcomingTasks = await prisma.task.findMany({
    where: {
      workspaceId,
      assigneeId: auth.userId,
      status: { not: "done" },
      parentTaskId: null,
      dueDate: {
        gte: todayStart,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  })

  // 未読通知数
  const unreadCount = await prisma.notification.count({
    where: { userId: auth.userId, read: false },
  })

  return (
    <DashboardView
      stats={{
        totalTasks,
        overdueTasks,
        dueTodayTasks,
        completedTodayTasks,
        unreadNotifications: unreadCount,
      }}
      recentCompletedTasks={JSON.parse(JSON.stringify(recentCompletedTasks))}
      upcomingTasks={JSON.parse(JSON.stringify(upcomingTasks))}
      workspaceId={workspaceId}
    />
  )
}
