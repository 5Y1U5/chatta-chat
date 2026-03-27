"use client"

import { usePathname } from "next/navigation"
import { MobileSidebar } from "@/components/chat/MobileSidebar"
import { MobilePageTitle } from "@/components/chat/MobilePageTitle"
import { MobileTaskHeader } from "@/components/task/MobileTaskHeader"

type ChannelItem = {
  id: string
  name: string | null
  type: string
  unreadCount: number
  members: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }[]
}

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
  channels: ChannelItem[]
  workspaceId: string
  currentUserId: string
  projects: ProjectInfo[]
}

export function MobileHeaderSwitch({ channels, workspaceId, currentUserId, projects }: Props) {
  const pathname = usePathname()
  const isTaskRelated = pathname.includes("/tasks") || pathname.includes("/projects")

  if (isTaskRelated) {
    return <MobileTaskHeader workspaceId={workspaceId} projects={projects} />
  }

  return (
    <>
      <MobileSidebar
        channels={channels}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
      />
      <MobilePageTitle />
    </>
  )
}
