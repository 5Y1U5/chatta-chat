"use client"

import { useState } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

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

export function MobileTaskHeader({ workspaceId, projects }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  const currentProjectId = searchParams.get("projectId")
  const isMyTasks = pathname.includes("/tasks") && !currentProjectId
  const isProjectsPage = pathname.includes("/projects")
  const currentProject = projects.find((p) => p.id === currentProjectId)

  // タスク/プロジェクト関連ページでなければ表示しない
  const isTaskRelated = pathname.includes("/tasks") || pathname.includes("/projects")
  if (!isTaskRelated) return null

  // プロジェクト選択時のヘッダー
  if (currentProject) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <button
          onClick={() => window.history.pushState(null, "", `/${workspaceId}/tasks`)}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: currentProject.color || "#6B7280" }}
        />
        <span className="font-semibold text-sm truncate flex-1">
          {currentProject.name}
        </span>
      </div>
    )
  }

  // プロジェクト管理ページ
  if (isProjectsPage) {
    return (
      <span className="font-semibold text-sm truncate flex-1">
        プロジェクト
      </span>
    )
  }

  // マイタスク時のヘッダー（ドロップダウン付き）
  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 touch-manipulation active:bg-muted/70 transition-colors"
      >
        <span className="font-semibold text-sm truncate">マイタスク</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-xl" showCloseButton={false}>
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm">タスクナビゲーション</SheetTitle>
          </SheetHeader>

          <div className="space-y-1 pb-4">
            {/* マイタスク */}
            <button
              onClick={() => {
                setSheetOpen(false)
                window.history.pushState(null, "", `/${workspaceId}/tasks`)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm touch-manipulation active:bg-muted/80 transition-colors",
                isMyTasks && "bg-muted font-medium"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              マイタスク
              {isMyTasks && (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-primary">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {/* セパレータ */}
            <div className="mx-3 my-2 border-t" />

            {/* プロジェクトセクション */}
            {projects.length > 0 && (
              <>
                <div className="px-3 py-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">プロジェクト</span>
                </div>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSheetOpen(false)
                      window.history.pushState(null, "", `/${workspaceId}/tasks?projectId=${project.id}`)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm touch-manipulation active:bg-muted/80 transition-colors"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color || "#6B7280" }}
                    />
                    <span className="truncate">{project.name}</span>
                    {project.totalTasks > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {project.completedTasks}/{project.totalTasks}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {/* セパレータ */}
            <div className="mx-3 my-2 border-t" />

            {/* すべてのPJ管理 */}
            <button
              onClick={() => {
                setSheetOpen(false)
                router.push(`/${workspaceId}/projects`)
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground touch-manipulation active:bg-muted/80 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              すべてのプロジェクト管理
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
