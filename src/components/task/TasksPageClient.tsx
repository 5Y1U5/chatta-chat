"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { TaskListView } from "@/components/task/TaskListView"
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

function TasksPageClientInner(props: Props) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId") || props.initialProjectId
  const viewKey = projectId ? `project-${projectId}` : "my-tasks"
  const project = projectId ? props.projects.find((p) => p.id === projectId) : null

  return (
    <div className="h-full">
      <TaskListView
        key={viewKey}
        tasks={props.initialTasks}
        projects={props.projects}
        members={props.members}
        workspaceId={props.workspaceId}
        currentUserId={props.currentUserId}
        viewMode={projectId ? "project" : "my-tasks"}
        projectId={projectId}
        projectName={project?.name}
        projectColor={project?.color}
        projectMembers={props.initialProjectMembers}
        initialSelectedTaskId={props.initialSelectedTaskId}
        projectMyRole={project?.myRole}
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
