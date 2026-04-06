// TaskNav のデータ取得用 Server Component（Suspense で非同期ストリーミング）

import { getPrisma } from "@/lib/prisma"
import { TaskNav } from "@/components/task/TaskNav"

type Props = {
  workspaceId: string
  userId: string
}

export async function TaskNavData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  // _count で集計クエリに置換（全タスク行のロードを回避）
  const projectsRaw = await prisma.project.findMany({
    where: {
      workspaceId,
      archived: false,
      members: { some: { userId } },
    },
    select: {
      id: true,
      name: true,
      color: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  const projectIds = projectsRaw.map((p) => p.id)

  // 4つの集計を並列実行（全タスク行ロードの代わりに集計クエリを使用）
  const [rootCounts, rootCompleted, subCounts, subCompleted] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId"],
      where: { workspaceId, parentTaskId: null, projectId: { in: projectIds } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { workspaceId, parentTaskId: null, status: "done", projectId: { in: projectIds } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { workspaceId, parentTaskId: { not: null }, projectId: { in: projectIds } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { workspaceId, parentTaskId: { not: null }, status: "done", projectId: { in: projectIds } },
      _count: true,
    }),
  ])

  const rootMap = new Map(rootCounts.map((c) => [c.projectId, c._count]))
  const rootCompletedMap = new Map(rootCompleted.map((c) => [c.projectId, c._count]))
  const subMap = new Map(subCounts.map((c) => [c.projectId, c._count]))
  const subCompletedMap = new Map(subCompleted.map((c) => [c.projectId, c._count]))

  const projects = projectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    totalParentTasks: rootMap.get(p.id) || 0,
    completedParentTasks: rootCompletedMap.get(p.id) || 0,
    totalSubTasks: subMap.get(p.id) || 0,
    completedSubTasks: subCompletedMap.get(p.id) || 0,
  }))

  return (
    <TaskNav
      workspaceId={workspaceId}
      projects={projects}
    />
  )
}
