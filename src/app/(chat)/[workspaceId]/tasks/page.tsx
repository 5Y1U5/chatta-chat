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
      where: { workspaceId, archived: false },
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
  const validProjectId = initialProjectId && projects.some((p) => p.id === initialProjectId)
    ? initialProjectId
    : undefined

  let initialTasks
  let initialProjectMembers: { id: string; displayName: string | null; avatarUrl: string | null }[] = []

  if (validProjectId) {
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

    // プロジェクトメンバーでなければ自動追加
    const isMember = pmRaw.some((pm) => pm.userId === auth.userId)
    if (!isMember) {
      await prisma.projectMember.create({
        data: { projectId: validProjectId, userId: auth.userId },
      }).catch(() => {})
      const selfUser = membersRaw.find((m) => m.user.id === auth.userId)
      if (selfUser) {
        pmRaw.push({
          projectId: validProjectId,
          userId: auth.userId,
          createdAt: new Date(),
          user: selfUser.user,
        } as typeof pmRaw[number])
      }
    }

    initialTasks = tasks
    initialProjectMembers = pmRaw.map((pm) => pm.user)
  } else {
    initialTasks = await prisma.task.findMany({
      where: {
        workspaceId,
        parentTaskId: null,
        projectId: null,
        OR: [
          { assigneeId: auth.userId },
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
      projects={JSON.parse(JSON.stringify(projects))}
      members={membersRaw.map((m) => m.user)}
      initialTasks={JSON.parse(JSON.stringify(initialTasks))}
      initialProjectId={validProjectId}
      initialProjectMembers={initialProjectMembers}
      initialSelectedTaskId={initialTaskId}
    />
  )
}
