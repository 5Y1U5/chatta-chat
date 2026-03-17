import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { TaskListView } from "@/components/task/TaskListView"

export default async function MyTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ projectId?: string; taskId?: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const { projectId, taskId: initialTaskId } = await searchParams
  const prisma = getPrisma()

  const userSelect = { id: true, displayName: true, avatarUrl: true } as const

  // プロジェクトビューの場合
  if (projectId) {
    // プロジェクト情報取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, color: true, workspaceId: true },
    })

    if (!project || project.workspaceId !== workspaceId) {
      // プロジェクトが見つからない場合はマイタスクにフォールバック
      return renderMyTasks({ auth, workspaceId, prisma, userSelect, initialTaskId })
    }

    // 全クエリを並列実行
    const [tasks, projectMembersRaw, projects, membersRaw] = await Promise.all([
      // プロジェクトのタスク取得
      prisma.task.findMany({
        where: {
          workspaceId,
          projectId,
          parentTaskId: null,
        },
        include: {
          assignee: { select: userSelect },
          creator: { select: userSelect },
          project: { select: { id: true, name: true, color: true } },
          _count: { select: { subTasks: true, comments: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      }),
      // プロジェクトメンバー一覧
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "asc" },
      }),
      // プロジェクト一覧（タスク作成時の選択肢用）
      prisma.project.findMany({
        where: { workspaceId, archived: false },
        orderBy: { name: "asc" },
      }),
      // ワークスペースメンバー一覧
      prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          user: { email: { not: "ai@chatta-chat.local" } },
        },
        include: { user: { select: userSelect } },
      }),
    ])

    // プロジェクトメンバーでなければ自動追加（API側と整合性を確保）
    const isMember = projectMembersRaw.some((pm) => pm.userId === auth.userId)
    if (!isMember) {
      await prisma.projectMember.create({
        data: { projectId, userId: auth.userId },
      }).catch(() => {}) // 競合時は無視
      // メンバー一覧に自分を追加
      const selfUser = membersRaw.find((m) => m.user.id === auth.userId)
      if (selfUser) {
        projectMembersRaw.push({
          projectId,
          userId: auth.userId,
          createdAt: new Date(),
          user: selfUser.user,
        } as typeof projectMembersRaw[number])
      }
    }
    const projectMembers = projectMembersRaw

    return (
      <TaskListView
        key={`project-${projectId}`}
        tasks={JSON.parse(JSON.stringify(tasks))}
        projects={JSON.parse(JSON.stringify(projects))}
        members={membersRaw.map((m) => m.user)}
        workspaceId={workspaceId}
        currentUserId={auth.userId}
        viewMode="project"
        projectId={projectId}
        projectName={project.name}
        projectColor={project.color}
        projectMembers={projectMembers.map((pm) => pm.user)}
        initialSelectedTaskId={initialTaskId}
      />
    )
  }

  // マイタスクビュー
  return renderMyTasks({ auth, workspaceId, prisma, userSelect, initialTaskId })
}

async function renderMyTasks({
  auth,
  workspaceId,
  prisma,
  userSelect,
  initialTaskId,
}: {
  auth: { userId: string; workspaceId: string }
  workspaceId: string
  prisma: ReturnType<typeof import("@/lib/prisma").getPrisma>
  userSelect: { id: true; displayName: true; avatarUrl: true }
  initialTaskId?: string
}) {
  // 全クエリを並列実行
  const [tasks, projects, members] = await Promise.all([
    // 自分に割り当てられた or TaskMember として追加されたルートタスク（プロジェクト所属タスクを除外）
    prisma.task.findMany({
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
    }),
    // プロジェクト一覧（タスク作成時の選択肢用）
    prisma.project.findMany({
      where: { workspaceId, archived: false },
      orderBy: { name: "asc" },
    }),
    // ワークスペースメンバー一覧（担当者選択用、AIユーザーを除外）
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { not: "ai@chatta-chat.local" } },
      },
      include: { user: { select: userSelect } },
    }),
  ])

  return (
    <TaskListView
      key="my-tasks"
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      members={members.map((m) => m.user)}
      workspaceId={workspaceId}
      currentUserId={auth.userId}
      viewMode="my-tasks"
      initialSelectedTaskId={initialTaskId}
    />
  )
}
