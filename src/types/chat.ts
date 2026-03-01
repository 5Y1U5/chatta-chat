// メッセージ表示用（Server → Client にシリアライズ可能な形式）
export type MessageWithUser = {
  id: string
  content: string
  createdAt: string
  userId: string
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
