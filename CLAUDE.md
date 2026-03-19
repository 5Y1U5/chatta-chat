# chatta-chat

AI ネイティブなチャットコミュニケーションツール。Slack/Chatwork のような汎用チャットに AI が最初から組み込まれた設計。社内向けツールとして展開中。

## 用語

| コード内 | UI 表示 | 説明 |
|---------|---------|------|
| channel (public) | グループチャット | 複数人のチャットルーム |
| channel (dm) | ダイレクトメッセージ | 1対1のチャット |
| general | マイチャット | 新規ワークスペース作成時のデフォルトグループチャット名 |

## 技術スタック

| 項目 | 選択 |
|------|------|
| フレームワーク | Next.js 16.1.6 (App Router) + TypeScript |
| DB | Supabase Free (PostgreSQL) |
| リアルタイム | Supabase Realtime (postgres_changes + Presence) |
| ORM | Prisma 7.x + PrismaPg adapter（出力先: `src/generated/prisma`） |
| 認証 | Supabase Auth (Email + Google OAuth) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| UI | shadcn/ui + Tailwind CSS v4 |
| バリデーション | Zod v4 |
| ホスティング | Vercel (Pro) |
| PWA | manifest.json + 最小 Service Worker |

## ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/login, signup           # 認証ページ（Suspense ラッパー必須）
│   ├── (chat)/                        # 3カラムレイアウト（h-dvh）
│   │   └── [workspaceId]/
│   │       ├── channel/[channelId]/   # メッセージビュー + スレッド
│   │       ├── tasks/                 # マイタスク一覧
│   │       ├── inbox/                 # 受信トレイ（通知一覧）
│   │       ├── projects/              # プロジェクト一覧
│   │       └── dashboard/             # ダッシュボード（タスク統計）
│   ├── invite/[code]/                 # ワークスペース招待ランディング
│   ├── ch/[code]/                     # グループチャット招待ランディング
│   └── api/
│       ├── auth/signup, callback      # 認証 + 招待コード処理
│       └── internal/                  # 内部 API（認証必須）
│           ├── channels/              # CRUD + invite + join + members + read + memories
│           ├── messages/              # CRUD + search + summarize + minutes
│           ├── dm/                    # DM 作成
│           ├── members/               # ワークスペースメンバー一覧
│           ├── profile/               # プロフィール更新
│           ├── reactions/             # リアクション
│           ├── upload/                # ファイルアップロード
│           ├── workspaces/invite,join # ワークスペース招待
│           ├── projects/              # プロジェクト CRUD
│           ├── tasks/                 # タスク CRUD + ステータス更新 + comments
│           ├── notifications/         # 通知一覧 + 既読更新
│           └── ai/suggest-reply       # AI 返信候補生成
├── components/
│   ├── ui/           # shadcn（Calendar, DatePicker, Popover 等）
│   ├── auth/         # LoginForm, SignupForm, GoogleLoginButton
│   ├── chat/         # WorkspaceSidebar, ChannelList, MessageView, MessageInput,
│   │                 # SummarizeDialog, MinutesDialog, MemoryPanel, VoiceRecorder
│   ├── task/         # TaskListView, TaskItem, TaskDetailPanel, CreateTaskDialog,
│   │                 # InboxView, ProjectListView, DashboardView
│   └── pwa/          # InstallBanner, ServiceWorkerRegister
├── hooks/
│   ├── useRealtimeMessages.ts    # メッセージのリアルタイム購読
│   ├── useUnreadCounts.ts        # 未読数管理
│   └── useTypingIndicator.ts     # タイピングインジケータ（Presence）
├── lib/
│   ├── supabase/     # client, server, middleware, admin
│   ├── ai/           # assistant.ts, claude.ts, providers.ts, detect-important.ts
│   ├── recurrence.ts # RRULE パース・生成・次回日時計算（繰り返しタスク）
│   ├── prisma.ts     # シングルトン
│   ├── auth.ts       # requireAuth / getAuthContext
│   └── config.ts     # 環境変数管理
├── generated/prisma/ # Prisma 生成ファイル（.gitignore 対象）
└── types/chat.ts     # MessageWithUser, TaskInfo, ProjectInfo, NotificationInfo 等
public/
├── manifest.json     # PWA マニフェスト
├── sw.js             # Service Worker
└── icons/            # PWA アイコン（192, 512, apple-touch）
```

## DB モデル

### チャット系
- **User**: Supabase Auth と 1:1。email, displayName, avatarUrl
- **Workspace**: 組織/チーム単位。name, iconUrl, inviteCode (unique)
- **WorkspaceMember**: User と Workspace の中間テーブル。role (admin/member)
- **Channel**: type (dm/group/public), inviteCode (unique)。workspaceId で所属
- **ChannelMember**: User と Channel の中間テーブル。lastReadAt (既読管理)
- **Message**: channelId, userId, content, parentId (スレッド), aiGenerated, fileUrl/fileName/fileType
- **Reaction**: messageId, userId, emoji
- **ChannelMemory**: AI が自動検出した重要事項（decision/deadline/action/info）

### タスク管理系
- **Project**: workspaceId, name, description, color, archived
- **Task**: workspaceId, projectId, parentTaskId（サブタスク）, title, description, status (todo/in_progress/done), priority (none/low/medium/high), assigneeId, creatorId, dueDate, recurrenceRule (RRULE文字列), nextOccurrence
- **TaskComment**: taskId, userId, content
- **Notification**: workspaceId, userId, actorId, type (task_assigned/task_completed/task_commented), title, taskId, projectId, read

## コマンド

```bash
npm run dev              # 開発サーバー
npm run build            # prisma generate && next build
npx prisma db push       # スキーマ反映（migrate dev ではなく db push を使用）
npx prisma generate      # クライアント生成
```

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=            # Supabase pooler (transaction mode)
DIRECT_URL=              # Supabase direct connection
ANTHROPIC_API_KEY=       # Claude API キー
```

## 主要な実装パターン

- **モバイル対応**: `h-dvh`（`h-screen` ではなく）、`shrink-0` でヘッダー固定、`min-h-0` で flex overflow 制御
- **Prisma 出力先**: `src/generated/prisma`。`.gitignore` 対象のため、ビルド時に `prisma generate` 必須
- **`useSearchParams()`**: 使用するコンポーネントは `<Suspense>` でラップ必須（Next.js 要件）
- **招待フロー**: `inviteCode` 12文字（`crypto.randomUUID().replace(/-/g, "").slice(0, 12)`）
- **AI チャット**: `@AI` メンション → `after()` でバックグラウンド応答生成 → Realtime で配信。失敗時はエラーメッセージをチャットに投稿
- **AI 機能**: 返信候補生成、会話要約、議事録生成、重要事項自動検出（5メッセージごとにバッチ分析）
- **繰り返しタスク**: RFC 5545 RRULE 形式。`rrule` ライブラリで処理。完了時に次回タスクを自動生成
- **AIユーザー除外**: タスク担当者選択時に `ai@chatta-chat.local` をフィルタ
- **Realtime**: `postgres_changes` で messages テーブル購読。Presence でタイピングインジケータ
- **サイドバー**: WorkspaceSidebar はトグルで展開/折りたたみ可能（展開時: アイコン+ラベル、折りたたみ時: アイコンのみ）
- **ChannelList 表示条件**: チャットページ（ワークスペースルート or `/channel/`）のみ表示。タスク・受信トレイ・ダッシュボード等では非表示
- **DatePicker**: `<input type="date">` ではなく `DatePicker` コンポーネント（ボタン+カレンダーポップオーバー）を使用。`date-fns` + `react-day-picker` ベース

## デプロイ・マージフロー

1. feature ブランチにコミット & プッシュ
2. Vercel のプレビュー URL を提示（`https://chatta-chat-<hash>-5y1u5s-projects.vercel.app` 形式）
3. ユーザーが動作確認 → マージ指示を待つ
4. 指示を受けてから main にマージ & プッシュ

**重要**: main へのマージはユーザーの明示的な指示があるまで行わない

## 事業開始チェックリスト

`tasks/business-launch-checklist.md` に、電気通信事業届出・利用規約・料金プラン等の事業化に必要なタスク一覧を管理。

## コーディング規約

- TypeScript strict モード
- 会話・コミット・コメントはすべて日本語
- feature ブランチで開発 → main へマージ（main に直接コミットしない）
