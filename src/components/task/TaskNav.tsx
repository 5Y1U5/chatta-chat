"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CreateProjectDialog } from "@/components/task/CreateProjectDialog"

type ProjectInfo = {
  id: string
  name: string
  color: string | null
  totalParentTasks: number
  completedParentTasks: number
  totalSubTasks: number
  completedSubTasks: number
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
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // タスク関連ページのみ表示
  const isTaskPage = pathname.includes("/tasks") || pathname.includes("/projects")

  const currentProjectId = searchParams.get("projectId")
  const isMyTasks = pathname.includes("/tasks") && !currentProjectId
  const isProjectsPage = pathname.includes("/projects")

  // マイタスク選択時はデフォルト折りたたみ、プロジェクト選択時は展開
  const [projectsExpanded, setProjectsExpanded] = useState(!isMyTasks)

  // ページ遷移に応じて折りたたみ状態を同期
  useEffect(() => {
    if (isMyTasks) {
      setProjectsExpanded(false)
    }
  }, [isMyTasks])

  // プロジェクト切り替えドロップダウンの外側クリックで閉じる
  useEffect(() => {
    if (!projectDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [projectDropdownOpen])

  if (!isTaskPage) return null

  const selectedProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null

  // プロジェクトの進捗を計算するヘルパー
  const getProjectProgress = (project: ProjectInfo) => {
    const totalAll = project.totalParentTasks + project.totalSubTasks
    const completedAll = project.completedParentTasks + project.completedSubTasks
    return {
      totalAll,
      completedAll,
      progress: totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0,
    }
  }

  return (
    <div className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
      {/* ヘッダー */}
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <span className="text-sm font-semibold text-muted-foreground">タスク</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* マイタスク */}
        <Link
          href={`/${workspaceId}/tasks`}
          scroll={false}
          prefetch={true}
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
        </Link>

        {/* セパレータ */}
        <div className="mx-4 my-2 border-t" />

        {/* プロジェクトセクション */}
        <div className="mb-2">
          {/* プロジェクトヘッダー（折りたたみトグル） */}
          <div className="flex items-center justify-between px-4 py-1">
            <button
              onClick={() => setProjectsExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase hover:text-foreground transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform duration-200",
                  projectsExpanded ? "rotate-90" : ""
                )}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              プロジェクト
            </button>
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

          {/* プロジェクト選択中: 選択されたプロジェクトのみ表示（折りたたみ時） */}
          {selectedProject && !projectsExpanded && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen((prev) => !prev)}
                className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-muted font-medium text-left w-[calc(100%-1rem)]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: selectedProject.color || "#6B7280" }}
                />
                <span className="flex-1 truncate">{selectedProject.name}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground shrink-0"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* ドロップダウン: 他プロジェクトに切り替え */}
              {projectDropdownOpen && (
                <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
                  {projects
                    .filter((p) => p.id !== currentProjectId)
                    .map((project) => (
                      <Link
                        key={project.id}
                        href={`/${workspaceId}/tasks?projectId=${project.id}`}
                        scroll={false}
                        prefetch={true}
                        onClick={() => setProjectDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color || "#6B7280" }}
                        />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    ))}
                  {projects.filter((p) => p.id !== currentProjectId).length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      他のプロジェクトはありません
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* プロジェクト一覧（展開時） */}
          {projectsExpanded && (
            <>
              {projects.map((project) => {
                const isActive = currentProjectId === project.id
                const { totalAll, progress } = getProjectProgress(project)

                return (
                  <Link
                    key={project.id}
                    href={`/${workspaceId}/tasks?projectId=${project.id}`}
                    scroll={false}
                    prefetch={true}
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
                      {totalAll > 0 && (
                        <>
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
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>タスク {project.completedParentTasks}/{project.totalParentTasks}</span>
                            {project.totalSubTasks > 0 && (
                              <span>サブ {project.completedSubTasks}/{project.totalSubTasks}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                )
              })}

              {projects.length === 0 && (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  プロジェクトはまだありません
                </p>
              )}
            </>
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
          router.push(`/${workspaceId}/tasks`, { scroll: false })
        }}
      />
    </div>
  )
}
