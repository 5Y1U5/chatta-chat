"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { TaskListView } from "@/components/task/TaskListView"
import { cn } from "@/lib/utils"
import type { TaskInfo } from "@/types/chat"

type Props = {
  workspaceId: string
  currentUserId: string
  projects: { id: string; name: string; color: string | null; myRole?: string }[]
  members: { id: string; displayName: string | null; avatarUrl: string | null }[]
  initialTasks: TaskInfo[]
  initialProjectId?: string
  initialProjectMembers: { id: string; displayName: string | null; avatarUrl: string | null }[]
  initialSelectedTaskId?: string
}

type ViewState = {
  key: string
  tasks: TaskInfo[]
  viewMode: "my-tasks" | "project"
  projectId?: string
  projectName?: string
  projectColor?: string | null
  projectMembers: { id: string; displayName: string | null; avatarUrl: string | null }[]
  projectMyRole?: string
}

function TasksPageClientInner(props: Props) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId") || undefined
  const targetKey = projectId ? `project-${projectId}` : "my-tasks"

  const initialProject = props.initialProjectId
    ? props.projects.find((p) => p.id === props.initialProjectId)
    : null

  const [view, setView] = useState<ViewState>({
    key: props.initialProjectId ? `project-${props.initialProjectId}` : "my-tasks",
    tasks: props.initialTasks,
    viewMode: props.initialProjectId ? "project" : "my-tasks",
    projectId: props.initialProjectId,
    projectName: initialProject?.name,
    projectColor: initialProject?.color,
    projectMembers: props.initialProjectMembers,
    projectMyRole: initialProject?.myRole,
  })
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (targetKey === view.key) return

    setTransitioning(true)

    const project = projectId ? props.projects.find((p) => p.id === projectId) : null
    const params = new URLSearchParams()
    if (!projectId) params.set("assigneeId", props.currentUserId)
    if (projectId) params.set("projectId", projectId)

    const fetches: Promise<unknown>[] = [
      fetch(`/api/internal/tasks?${params}`).then((r) => (r.ok ? r.json() : [])),
    ]
    if (projectId) {
      fetches.push(
        fetch(`/api/internal/projects/members?projectId=${projectId}`).then((r) =>
          r.ok ? r.json() : []
        )
      )
    }

    Promise.all(fetches).then(([tasks, members]) => {
      setView({
        key: targetKey,
        tasks: tasks as TaskInfo[],
        viewMode: projectId ? "project" : "my-tasks",
        projectId,
        projectName: project?.name,
        projectColor: project?.color,
        projectMyRole: project?.myRole,
        projectMembers: members
          ? (members as { userId: string; displayName: string | null; avatarUrl: string | null }[]).map(
              (m) => ({ id: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl })
            )
          : [],
      })
      setTransitioning(false)
    })
    // targetKey の変化だけで発火（view.key は含めない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  return (
    <div className={cn("h-full", transitioning && "opacity-50 pointer-events-none transition-opacity duration-150")}>
      <TaskListView
        key={view.key}
        tasks={view.tasks}
        projects={props.projects}
        members={props.members}
        workspaceId={props.workspaceId}
        currentUserId={props.currentUserId}
        viewMode={view.viewMode}
        projectId={view.projectId}
        projectName={view.projectName}
        projectColor={view.projectColor}
        projectMembers={view.projectMembers}
        initialSelectedTaskId={props.initialSelectedTaskId}
        projectMyRole={view.projectMyRole}
      />
    </div>
  )
}

export function TasksPageClient(props: Props) {
  return (
    <Suspense>
      <TasksPageClientInner {...props} />
    </Suspense>
  )
}
