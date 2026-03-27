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
      tasks: {
        select: { id: true, status: true, parentTaskId: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const projects = projectsRaw.map((p) => {
    const parentTasks = p.tasks.filter((t) => !t.parentTaskId)
    const subTasks = p.tasks.filter((t) => t.parentTaskId)
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      // 親タスク
      totalParentTasks: parentTasks.length,
      completedParentTasks: parentTasks.filter((t) => t.status === "done").length,
      // サブタスク
      totalSubTasks: subTasks.length,
      completedSubTasks: subTasks.filter((t) => t.status === "done").length,
    }
  })

  return (
    <TaskNav
      workspaceId={workspaceId}
      projects={projects}
    />
  )
}
