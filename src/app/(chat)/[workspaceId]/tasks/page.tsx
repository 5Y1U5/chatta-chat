import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { TaskListView } from "@/components/task/TaskListView"

export default async function MyTasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const prisma = getPrisma()

  const userSelect = { id: true, displayName: true, avatarUrl: true } as const

  // 自分に割り当てられたルートタスク
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      assigneeId: auth.userId,
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

  // プロジェクト一覧（タスク作成時の選択肢用）
  const projects = await prisma.project.findMany({
    where: { workspaceId, archived: false },
    orderBy: { name: "asc" },
  })

  // ワークスペースメンバー一覧（担当者選択用）
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: userSelect } },
  })

  return (
    <TaskListView
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      members={members.map((m) => m.user)}
      workspaceId={workspaceId}
      currentUserId={auth.userId}
      viewMode="my-tasks"
    />
  )
}
