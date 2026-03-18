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
      where: {
        workspaceId,
        archived: false,
        members: { some: { userId: auth.userId } },
      },
      include: {
        _count: { select: { tasks: true } },
        members: {
          where: { userId: auth.userId },
          select: { role: true },
          take: 1,
        },
      },
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

  const projectsWithRole = projects.map(({ members: memberRows, ...p }) => ({
    ...p,
    myRole: memberRows[0]?.role || "member",
  }))

  return (
    <ProjectListView
      projects={JSON.parse(JSON.stringify(projectsWithRole))}
      members={membersRaw.map((m) => m.user)}
      workspaceId={workspaceId}
      currentUserId={auth.userId}
    />
  )
}
