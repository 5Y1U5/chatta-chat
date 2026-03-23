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
  const validProjectId: string | undefined = initialProjectId && projects.some((p) => p.id === initialProjectId)
    ? initialProjectId
    : undefined

  const taskInclude = {
    assignee: { select: userSelect },
    creator: { select: userSelect },
    project: { select: { id: true, name: true, color: true } },
    _count: { select: { subTasks: true, comments: true } },
  } as const
  const taskOrderBy = [{ status: "asc" as const }, { dueDate: "asc" as const }, { createdAt: "desc" as const }]

  let initialTasks
  let initialProjectMembers: { id: string; displayName: string | null; avatarUrl: string | null }[] = []

  if (validProjectId) {
    // メンバー確認とタスク・メンバー取得を並列実行
    const [isMember, tasks, pmRaw] = await Promise.all([
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: validProjectId, userId: auth.userId } },
      }),
      prisma.task.findMany({
        where: { workspaceId, projectId: validProjectId, parentTaskId: null },
        include: taskInclude,
        orderBy: taskOrderBy,
      }),
      prisma.projectMember.findMany({
        where: { projectId: validProjectId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
    ])

    if (isMember) {
      initialTasks = tasks
      initialProjectMembers = pmRaw.map((pm) => pm.user)
    }
  }

  if (!initialTasks) {
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
      include: taskInclude,
      orderBy: taskOrderBy,
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
      initialProjectId={initialTasks && validProjectId && initialProjectMembers.length > 0 ? validProjectId : undefined}
      initialProjectMembers={initialProjectMembers}
      initialSelectedTaskId={initialTaskId}
    />
  )
}
