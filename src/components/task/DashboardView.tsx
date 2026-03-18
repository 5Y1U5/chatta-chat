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
  bgColor,
  icon,
  onClick,
}: {
  label: string
  value: number
  color?: string
  bgColor?: string
  icon: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      className={cn(
        "rounded-xl border p-4 text-left hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group",
        bgColor
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {icon}
        </span>
        <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
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

  const totalAll = stats.totalTasks + stats.completedTodayTasks
  const completionRate = totalAll > 0 ? Math.round((stats.completedTodayTasks / totalAll) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-y-auto page-enter">
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <h1 className="text-lg font-semibold">ダッシュボード</h1>
      </div>

      <div className="p-4 space-y-6 max-w-4xl">
        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="未完了タスク"
            value={stats.totalTasks}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="期限切れ"
            value={stats.overdueTasks}
            color={stats.overdueTasks > 0 ? "text-red-500" : undefined}
            bgColor={stats.overdueTasks > 0 ? "bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-900/30" : undefined}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stats.overdueTasks > 0 ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="今日が期限"
            value={stats.dueTodayTasks}
            color={stats.dueTodayTasks > 0 ? "text-orange-500" : undefined}
            bgColor={stats.dueTodayTasks > 0 ? "bg-orange-50/50 border-orange-200 dark:bg-orange-950/10 dark:border-orange-900/30" : undefined}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stats.dueTodayTasks > 0 ? "#f97316" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            }
            onClick={() => router.push(`/${workspaceId}/tasks`)}
          />
          <StatCard
            label="今日の完了"
            value={stats.completedTodayTasks}
            color="text-primary"
            bgColor={stats.completedTodayTasks > 0 ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/10 dark:border-blue-900/30" : undefined}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stats.completedTodayTasks > 0 ? "#3b82f6" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
        </div>

        {/* 今日の進捗バー */}
        {(stats.totalTasks > 0 || stats.completedTodayTasks > 0) && (
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">今日の進捗</span>
              <span className="text-sm text-muted-foreground">
                {stats.completedTodayTasks} / {totalAll} タスク ({completionRate}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 期限間近のタスク */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              今後1週間の期限
            </h2>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">期限が近いタスクはありません</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task, i) => (
                  <button
                    key={task.id}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/50 hover:shadow-sm transition-all duration-200 stagger-item"
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => router.push(`/${workspaceId}/tasks`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{task.title}</div>
                      {task.project && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-sm mt-0.5 inline-block"
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
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
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
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              チームの最近の完了
            </h2>
            {recentCompletedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">最近完了したタスクはありません</p>
            ) : (
              <div className="space-y-2">
                {recentCompletedTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 stagger-item"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
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
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
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
