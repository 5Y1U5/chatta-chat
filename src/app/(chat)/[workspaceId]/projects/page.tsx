import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { ProjectListView } from "@/components/task/ProjectListView"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const auth = await requireAuth()
  const { workspaceId } = await params
  const prisma = getPrisma()

  const projects = await prisma.project.findMany({
    where: { workspaceId, archived: false },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <ProjectListView
      projects={JSON.parse(JSON.stringify(projects))}
      workspaceId={workspaceId}
    />
  )
}
