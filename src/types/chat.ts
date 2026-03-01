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
  user: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
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
