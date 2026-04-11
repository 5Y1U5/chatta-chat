"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"

type Props = {
  workspaceId: string
  unreadNotificationCount?: number
}

export function MobileBottomNav({ workspaceId, unreadNotificationCount = 0 }: Props) {
  const notificationBadge = useNotificationBadge(unreadNotificationCount)
  const pathname = usePathname()

  const isChatActive = pathname === `/${workspaceId}` || pathname.includes("/channel/")
  const isTasksActive = pathname.includes("/tasks") || pathname.includes("/projects")
  const isInboxActive = pathname.includes("/inbox")
  const isDashboardActive = pathname.includes("/dashboard")

  const navItems = [
    {
      label: "チャット",
      href: `/${workspaceId}`,
      active: isChatActive,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: "タスク",
      href: `/${workspaceId}/tasks`,
      active: isTasksActive,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      label: "受信トレイ",
      href: `/${workspaceId}/inbox`,
      active: isInboxActive,
      badge: notificationBadge,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      ),
    },
    {
      label: "ボード",
      href: `/${workspaceId}/dashboard`,
      active: isDashboardActive,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            prefetch={true}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full touch-manipulation transition-colors",
              item.active
                ? "text-primary nav-dot-indicator"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <span className="relative">
              {item.icon}
              {item.badge != null && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-badge-pulse">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </span>
            <span className={cn("text-[10px]", item.active && "font-medium")}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
