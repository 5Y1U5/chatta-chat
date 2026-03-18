import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { TasksPageClient } from "@/components/task/TasksPageClient"

export default async function MyTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ projectId?: string; taskId?: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const { projectId: initialProjectId, taskId: initialTaskId } = await searchParams
  const prisma = getPrisma()

  const userSelect = { id: true, displayName: true, avatarUrl: true } as const

  // 共通データを並列で取得
  const [projects, membersRaw] = await Promise.all([
    prisma.project.findMany({
      where: {
        workspaceId,
        archived: false,
        members: { some: { userId: auth.userId } },
      },
      include: {
        members: {
          where: { userId: auth.userId },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { not: "ai@chatta-chat.local" } },
      },
      include: { user: { select: userSelect } },
    }),
  ])

  // 初期ビューのデータを取得
  let validProjectId: string | undefined = initialProjectId && projects.some((p) => p.id === initialProjectId)
    ? initialProjectId
    : undefined

  let initialTasks
  let initialProjectMembers: { id: string; displayName: string | null; avatarUrl: string | null }[] = []

  if (validProjectId) {
    // プロジェクトメンバーか確認
    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: validProjectId, userId: auth.userId } },
    })

    if (isMember) {
      const [tasks, pmRaw] = await Promise.all([
        prisma.task.findMany({
          where: { workspaceId, projectId: validProjectId, parentTaskId: null },
          include: {
            assignee: { select: userSelect },
            creator: { select: userSelect },
            project: { select: { id: true, name: true, color: true } },
            _count: { select: { subTasks: true, comments: true } },
          },
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        }),
        prisma.projectMember.findMany({
          where: { projectId: validProjectId },
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        }),
      ])

      initialTasks = tasks
      initialProjectMembers = pmRaw.map((pm) => pm.user)
    } else {
      // メンバーでなければマイタスクにフォールバック
      validProjectId = undefined
    }
  }

  if (!validProjectId) {
    initialTasks = await prisma.task.findMany({
      where: {
        workspaceId,
        parentTaskId: null,
        projectId: null,
        OR: [
          { assigneeId: auth.userId },
          { creatorId: auth.userId },
          { members: { some: { userId: auth.userId } } },
        ],
      },
      include: {
        assignee: { select: userSelect },
        creator: { select: userSelect },
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { subTasks: true, comments: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    })
  }

  return (
    <TasksPageClient
      workspaceId={workspaceId}
      currentUserId={auth.userId}
      projects={JSON.parse(JSON.stringify(projects.map(({ members: memberRows, ...p }) => ({
        ...p,
        myRole: memberRows[0]?.role || "member",
      }))))}
      members={membersRaw.map((m) => m.user)}
      initialTasks={JSON.parse(JSON.stringify(initialTasks))}
      initialProjectId={validProjectId}
      initialProjectMembers={initialProjectMembers}
      initialSelectedTaskId={initialTaskId}
    />
  )
}
