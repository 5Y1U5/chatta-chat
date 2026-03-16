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

  const userSelect = { id: true, displayName: true, avatarUrl: true } as const

  const [projects, membersRaw] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, archived: false },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { not: "ai@chatta-chat.local" } },
      },
      include: { user: { select: userSelect } },
    }),
  ])

  return (
    <ProjectListView
      projects={JSON.parse(JSON.stringify(projects))}
      members={membersRaw.map((m) => m.user)}
      workspaceId={workspaceId}
    />
  )
}
