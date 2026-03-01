# chatta-chat

AI ネイティブなチャットコミュニケーションツール。Slack/Chatwork のような汎用チャットに AI が最初から組み込まれた設計。

## 技術スタック

| 項目 | 選択 |
|------|------|
| フレームワーク | Next.js (App Router) + TypeScript |
| DB | Supabase (PostgreSQL) |
| リアルタイム | Supabase Realtime (postgres_changes) |
| ORM | Prisma + PrismaPg adapter |
| 認証 | Supabase Auth |
| UI | shadcn/ui + Tailwind CSS |
| バリデーション | Zod v4 |
| ホスティング | Vercel |

## ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/login, signup         # 認証ページ
│   ├── (chat)/                      # 3カラムレイアウト
│   │   └── [workspaceId]/
│   │       └── channel/[channelId]/ # メッセージビュー
│   └── api/
│       ├── auth/signup, callback
│       └── internal/channels, messages
├── components/
│   ├── ui/           # shadcn
│   ├── auth/         # LoginForm, SignupForm
│   └── chat/         # WorkspaceSidebar, ChannelList, MessageView, MessageInput
├── hooks/
│   └── useRealtimeMessages.ts
├── lib/
│   ├── supabase/     # client, server, middleware, admin
│   ├── prisma.ts     # シングルトン（Chatta 流用）
│   ├── auth.ts       # getAuthContext（workspaceId 版）
│   └── config.ts     # 環境変数管理
└── types/chat.ts
```

## DB モデル

- **User**: Supabase Auth と 1:1。email, displayName, avatarUrl
- **Workspace**: 組織/チーム単位。name, iconUrl
- **WorkspaceMember**: User と Workspace の中間テーブル。role (admin/member)
- **Channel**: type (dm/group/public)。workspaceId で所属
- **ChannelMember**: User と Channel の中間テーブル
- **Message**: channelId, userId, content。parentId (スレッド用、Phase 2)、aiGenerated (Phase 2)

## コマンド

```bash
# 開発サーバー
npm run dev

# Prisma マイグレーション
npx prisma migrate dev --name <name>

# Prisma クライアント生成
npx prisma generate

# ビルド
npm run build
```

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=          # Supabase pooler (transaction mode)
DIRECT_URL=            # Supabase direct connection
```

## Supabase Realtime

- `postgres_changes` で `messages` テーブルの INSERT を購読
- `filter: channel_id=eq.${channelId}` で対象チャンネルに絞り込み
- Supabase 側で `ALTER PUBLICATION supabase_realtime ADD TABLE messages;` が必要

## コーディング規約

- TypeScript strict モード
- 会話・コミット・コメントはすべて日本語
- feature ブランチで開発 → main へマージ
