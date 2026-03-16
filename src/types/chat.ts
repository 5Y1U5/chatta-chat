// メッセージ表示用（Server → Client にシリアライズ可能な形式）
export type MessageWithUser = {
  id: string
  content: string
  createdAt: string
  updatedAt?: string
  userId: string
  parentId?: string | null
  aiGenerated?: boolean
  deletedAt?: string | null
  replyCount?: number
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  reactions?: ReactionInfo[]
  user: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
}

// リアクション集計情報
export type ReactionInfo = {
  emoji: string
  count: number
  userReacted: boolean // 現在のユーザーがリアクション済みか
}

// チャンネルメンバー情報
export type ChannelMemberInfo = {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

// チャンネル情報
export type ChannelInfo = {
  id: string
  workspaceId: string
  name: string | null
  type: string
  createdAt: Date
  updatedAt: Date
}

// プロジェクト情報
export type ProjectInfo = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  color: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  _count?: { tasks: number }
}

// タスク情報
export type TaskInfo = {
  id: string
  workspaceId: string
  projectId: string | null
  parentTaskId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  creatorId: string
  dueDate: string | null
  completedAt: string | null
  recurrenceRule: string | null
  sortOrder: number
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  createdAt: string
  updatedAt: string
  assignee: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  } | null
  creator: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
  project: {
    id: string
    name: string
    color: string | null
  } | null
  subTasks?: TaskInfo[]
  _count?: { subTasks: number; comments: number; members?: number }
}

// タスクコメント情報
export type TaskCommentInfo = {
  id: string
  taskId: string
  content: string
  createdAt: string
  user: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
}

// 通知情報
export type NotificationInfo = {
  id: string
  type: string
  title: string
  taskId: string | null
  projectId: string | null
  read: boolean
  createdAt: string
  actor: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
}
