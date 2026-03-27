// TaskNav のデータ取得用 Server Component（Suspense で非同期ストリーミング）

import { getPrisma } from "@/lib/prisma"
import { TaskNav } from "@/components/task/TaskNav"

type Props = {
  workspaceId: string
  userId: string
}

export async function TaskNavData({ workspaceId, userId }: Props) {
  const prisma = getPrisma()

  const projectsRaw = await prisma.project.findMany({
    where: {
      workspaceId,
      archived: false,
      members: { some: { userId } },
    },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        where: { status: "done" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const projects = projectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    totalTasks: p._count.tasks,
    completedTasks: p.tasks.length,
  }))

  return (
    <TaskNav
      workspaceId={workspaceId}
      projects={projects}
    />
  )
}
