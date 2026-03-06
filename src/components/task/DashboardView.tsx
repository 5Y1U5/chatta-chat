"use client"

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type Stats = {
  totalTasks: number
  overdueTasks: number
  dueTodayTasks: number
  completedTodayTasks: number
  unreadNotifications: number
}

type CompletedTask = {
  id: string
  title: string
  completedAt: string
  assignee: { id: string; displayName: string | null; avatarUrl: string | null } | null
}

type UpcomingTask = {
  id: string
  title: string
  dueDate: string | null
  status: string
  project: { id: string; name: string; color: string | null } | null
}

type Props = {
  stats: Stats
  recentCompletedTasks: CompletedTask[]
  upcomingTasks: UpcomingTask[]
  workspaceId: string
}

function StatCard({
  label,
  value,
  color,
  onClick,
}: {
  label: string
  value: number
  color?: string
  onClick?: () => void
}) {
  return (
    <button
      className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </button>
  )
}

export function DashboardView({
  stats,
  recentCompletedTasks,
  upcomingTasks,
  workspaceId,
}: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <h1 className="text-lg font-semibold">ダッシュボード</h1>
      </div>

      <div className="p-4 space-y-6 max-w-4xl">
        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="未完了タスク"
            value={stats.totalTasks}
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="期限切れ"
            value={stats.overdueTasks}
            color={stats.overdueTasks > 0 ? "text-red-500" : undefined}
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="今日が期限"
            value={stats.dueTodayTasks}
            color={stats.dueTodayTasks > 0 ? "text-orange-500" : undefined}
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="今日の完了"
            value={stats.completedTodayTasks}
            color="text-green-500"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 期限間近のタスク */}
          <div>
            <h2 className="text-sm font-semibold mb-3">今後1週間の期限</h2>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">期限が近いタスクはありません</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <button
                    key={task.id}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/${workspaceId}/tasks`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{task.title}</div>
                      {task.project && (
                        <span
                          className="text-[10px] px-1 py-0.5 rounded-sm"
                          style={{
                            backgroundColor: task.project.color ? `${task.project.color}20` : undefined,
                            color: task.project.color || undefined,
                          }}
                        >
                          {task.project.name}
                        </span>
                      )}
                    </div>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(task.dueDate).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* チームの最近の完了タスク */}
          <div>
            <h2 className="text-sm font-semibold mb-3">チームの最近の完了</h2>
            {recentCompletedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">最近完了したタスクはありません</p>
            ) : (
              <div className="space-y-2">
                {recentCompletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate line-through text-muted-foreground">
                        {task.title}
                      </div>
                    </div>
                    {task.assignee && (
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
                        title={task.assignee.displayName || ""}
                      >
                        {task.assignee.displayName?.charAt(0) || "?"}
                      </div>
                    )}
                    {task.completedAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(task.completedAt).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
