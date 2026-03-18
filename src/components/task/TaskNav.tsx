"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CreateProjectDialog } from "@/components/task/CreateProjectDialog"

type ProjectInfo = {
  id: string
  name: string
  color: string | null
  totalTasks: number
  completedTasks: number
}

type Props = {
  workspaceId: string
  projects: ProjectInfo[]
}

export function TaskNav({ workspaceId, projects }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  // タスク関連ページのみ表示
  const isTaskPage = pathname.includes("/tasks") || pathname.includes("/projects")
  if (!isTaskPage) return null

  const currentProjectId = searchParams.get("projectId")
  const isMyTasks = pathname.includes("/tasks") && !currentProjectId
  const isProjectsPage = pathname.includes("/projects")

  return (
    <div className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
      {/* ヘッダー */}
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <span className="text-sm font-semibold text-muted-foreground">タスク</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* マイタスク */}
        <button
          onClick={() => window.history.pushState(null, "", `/${workspaceId}/tasks`)}
          className={cn(
            "mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left",
            isMyTasks ? "bg-muted font-medium" : "hover:bg-muted/50"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          マイタスク
        </button>

        {/* セパレータ */}
        <div className="mx-4 my-2 border-t" />

        {/* プロジェクトセクション */}
        <div className="mb-2">
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              プロジェクト
            </span>
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="プロジェクトを作成"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {projects.map((project) => {
            const isActive = currentProjectId === project.id
            const progress = project.totalTasks > 0
              ? Math.round((project.completedTasks / project.totalTasks) * 100)
              : 0

            return (
              <button
                key={project.id}
                onClick={() => window.history.pushState(null, "", `/${workspaceId}/tasks?projectId=${project.id}`)}
                className={cn(
                  "mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-[calc(100%-1rem)]",
                  isActive ? "bg-muted font-medium" : "hover:bg-muted/50"
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: project.color || "#6B7280" }}
                />
                <div className="flex-1 min-w-0">
                  <span className="truncate block text-sm">{project.name}</span>
                  {project.totalTasks > 0 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: project.color || "#6B7280",
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {project.completedTasks}/{project.totalTasks}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {projects.length === 0 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              プロジェクトはまだありません
            </p>
          )}
        </div>

        {/* すべて表示 */}
        <Link
          href={`/${workspaceId}/projects`}
          className={cn(
            "mx-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
            isProjectsPage && "bg-muted font-medium text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          すべて表示
        </Link>
      </div>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={() => {
          setCreateProjectOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}
