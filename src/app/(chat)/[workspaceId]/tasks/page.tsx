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

    // プロジェクトメンバー確認（アクセス制御）
    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: auth.userId } },
    })

    // プロジェクトメンバーでない場合も表示（ワークスペースメンバーなら閲覧可能）
    // ただしメンバー制限がある場合は後でAPIレベルで制御

    // プロジェクトのタスク取得
    const tasks = await prisma.task.findMany({
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
    })

    // プロジェクトメンバー一覧
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    })

    // プロジェクト一覧（タスク作成時の選択肢用）
    const projects = await prisma.project.findMany({
      where: { workspaceId, archived: false },
      orderBy: { name: "asc" },
    })

    // ワークスペースメンバー一覧
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { not: "ai@chatta-chat.local" } },
      },
      include: { user: { select: userSelect } },
    })

    return (
      <TaskListView
        key={`project-${projectId}`}
        tasks={JSON.parse(JSON.stringify(tasks))}
        projects={JSON.parse(JSON.stringify(projects))}
        members={members.map((m) => m.user)}
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
  // 自分に割り当てられた or TaskMember として追加されたルートタスク（プロジェクト所属タスクを除外）
  const tasks = await prisma.task.findMany({
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

  // プロジェクト一覧（タスク作成時の選択肢用）
  const projects = await prisma.project.findMany({
    where: { workspaceId, archived: false },
    orderBy: { name: "asc" },
  })

  // ワークスペースメンバー一覧（担当者選択用、AIユーザーを除外）
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      user: { email: { not: "ai@chatta-chat.local" } },
    },
    include: { user: { select: userSelect } },
  })

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
