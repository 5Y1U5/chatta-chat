# chatta-chat

AI ネイティブなチャットコミュニケーションツール。Slack/Chatwork のような汎用チャットに AI が最初から組み込まれた設計。社内向けツールとして展開中。

## 用語

| コード内 | UI 表示 | 説明 |
|---------|---------|------|
| channel (public) | グループチャット | 複数人のチャットルーム。手動招待制（自動参加なし） |
| channel (dm) | ダイレクトメッセージ | 1対1のチャット |
| マイチャット | マイチャット | ユーザーごとに自動作成される個人専用チャット。メンバー追加不可・非共有。AI質問やメモ用 |

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
│   ├── p/[code]/                      # プロジェクト招待ランディング
│   ├── t/[token]/                     # ゲストタスク共有ページ（認証不要）
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
│           ├── projects/              # プロジェクト CRUD + invite + join + members
│           ├── tasks/                 # タスク CRUD + ステータス更新 + comments + share + members
│           ├── notifications/         # 通知一覧 + 既読更新 + アーカイブ
│           └── ai/suggest-reply       # AI 返信候補生成
│       └── guest/                     # ゲスト用 API（認証不要、トークン検証）
│           └── tasks/[token]/         # ゲストタスク閲覧 + コメント投稿
├── components/
│   ├── ui/           # shadcn（Calendar, DatePicker, Popover, PullToRefresh 等）
│   ├── auth/         # LoginForm, SignupForm, GoogleLoginButton
│   ├── chat/         # WorkspaceSidebar, ChannelList, MessageView, MessageInput,
│   │                 # SummarizeDialog, MinutesDialog, MemoryPanel, VoiceRecorder,
│   │                 # SidebarData, ChannelListData, MobileHeaderData, MobileBottomNavData（Suspense用Server Component）
│   ├── task/         # TaskListView, TaskItem, TaskDetailPanel, CreateTaskDialog,
│   │                 # InboxView, ProjectListView, DashboardView, TaskNavData（Suspense用Server Component）
│   └── pwa/          # InstallBanner, ServiceWorkerRegister
├── hooks/
│   ├── useRealtimeMessages.ts    # メッセージのリアルタイム購読
│   ├── useRealtimeTasks.ts       # タスクのリアルタイム購読（INSERT/UPDATE）
│   ├── useRealtimeComments.ts    # タスクコメントのリアルタイム購読
│   ├── useRealtimeNotifications.ts # 通知のリアルタイム購読
│   ├── useUnreadCounts.ts        # 未読数管理
│   └── useTypingIndicator.ts     # タイピングインジケータ（Presence）
├── lib/
│   ├── supabase/     # client, server, middleware, admin
│   ├── ai/           # assistant.ts, claude.ts, providers.ts, detect-important.ts, extract-tasks.ts
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
- **Project**: workspaceId, name, description, color, inviteCode (unique, プロジェクト招待用), archived
- **Task**: workspaceId, projectId, parentTaskId（サブタスク）, title, description, status (todo/in_progress/done), priority (none/low/medium/high), assigneeId, creatorId, dueDate, recurrenceRule (RRULE文字列), nextOccurrence
- **TaskComment**: taskId, userId, content
- **TaskShareLink**: taskId, token (unique, 32文字hex), createdBy, active, expiresAt — ゲスト共有リンク
- **GuestComment**: taskId, shareLinkId, guestName, content — 未登録ゲストのコメント
- **Notification**: userId, actorId, type (task_assigned/task_completed/task_comment/task_mentioned/task_collaborator/project_invited), title, body (コメント本文等), taskId, projectId, read, archived

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

### ローカル `.env.local` の取得方法

`.env.local` は Git 管理外。新しい端末でローカル開発を始めるときは以下のいずれかで取得する:

```bash
# 推奨: Vercel から development 環境変数を pull
vercel env pull --environment=development

# または .env.example をコピーして 1Password から手動で値を埋める
cp .env.example .env.local
# DATABASE_URL: op read "op://Personal/DATABASE_URL_ChattaChat/password"
# DIRECT_URL: 上記の値の :6543/ を :5432/ に置換
```

DB password は 1Password の `DATABASE_URL_ChattaChat` 経由で管理（2026-04-26 ローテ後）。
平文を `.env.local` に書いた場合は、コマンド出力やコピペで露出しないよう注意する。

## 主要な実装パターン

- **layout.tsx Suspense 分離**: DBクエリは SidebarData, ChannelListData, TaskNavData 等の Server Component に委譲し Suspense でラップ。children はクエリ完了を待たず即座にレンダリング開始。`router.refresh()` は layout 全体を再実行するため、ローカル state 更新で済む箇所では使わない
- **ページ遷移最適化**: TaskNav のリンクは `<Link prefetch={true}>` で hover 時に prefetch。TaskNavData はタスク数を `groupBy` 集計クエリで取得（全行ロードしない）。全ページに loading.tsx（スケルトン UI）を設置
- **モバイル対応**: `h-dvh`（`h-screen` ではなく）、`shrink-0` でヘッダー固定、`min-h-0` で flex overflow 制御。モバイルではTaskListViewのh1タイトルを非表示（MobileTaskHeaderと重複するため）。MobileBottomNavの「タスク」タブは`/tasks`と`/projects`の両方でアクティブ
- **Prisma 出力先**: `src/generated/prisma`。`.gitignore` 対象のため、ビルド時に `prisma generate` 必須
- **`useSearchParams()`**: 使用するコンポーネントは `<Suspense>` でラップ必須（Next.js 要件）
- **招待フロー**: `inviteCode` 12文字（`crypto.randomUUID().replace(/-/g, "").slice(0, 12)`）。ワークスペース・チャンネル・プロジェクト共通パターン。再参加時は「既に参加済みです」表示。**ワークスペース参加時はマイチャットのみ自動作成、他チャンネルは手動招待制**（Chatwork方式）
- **ゲスト共有**: `TaskShareLink.token` 32文字hex（`crypto.randomBytes(16).toString("hex")`）。`/t/[token]` で認証不要アクセス。GuestComment は TaskComment と別テーブル（userId NOT NULL 制約を壊さない）
- **AI チャット**: `@AI` メンション → `after()` でバックグラウンド応答生成 → Realtime で配信。失敗時はエラーメッセージをチャットに投稿
- **AI 機能**: 返信候補生成、会話要約、議事録生成、重要事項自動検出（5メッセージごとにバッチ分析）、チャット会話からのタスク自動抽出・登録（`@AI タスクに登録して` で親タスク+サブタスクを一括作成）
- **タスク一覧セクション構成**: 期限切れ（期日古い順・固定）→ 今日（ドラッグ並び替え可）→ 今後（期日近い順・固定）→ 期限なし（ドラッグ並び替え可）→ 今日完了 → 完了。期限切れ・今日・今後は該当タスクがある時のみ表示。今日・今後・期限なしセクションにインライン追加ボタンあり（モバイル・デスクトップ共通）。セクションに応じた期日が自動設定される（今日→今日、今後→明日、期限なし→なし）
- **繰り返しタスク**: RFC 5545 RRULE 形式。`rrule` ライブラリで処理。完了時に次回タスクを自動生成
- **AIユーザー除外**: タスク担当者選択時に `ai@chatta-chat.local` をフィルタ
- **Realtime**: `postgres_changes` で Message, Task（INSERT/UPDATE/DELETE）, TaskComment, GuestComment, Notification テーブルを購読。Presence でタイピングインジケータ。Realtime ペイロードのユーザー情報（displayName, avatarUrl）は呼び出し元の members リストから補完する。`router.refresh()` は認証フロー以外では使わず、楽観的更新 + ローカル state 管理で即座に UI に反映する
- **REPLICA IDENTITY**: Task テーブルは `REPLICA IDENTITY FULL` に設定済み（DELETE イベントで old レコードを受信するため）。設定 SQL: `supabase/enable-replica-identity.sql`
- **プルトゥリフレッシュ**: `PullToRefresh` コンポーネントでタスク一覧・受信トレイ・プロジェクト一覧に適用。ネイティブイベントリスナー（`passive: false`）で `preventDefault()` を使い、ブラウザ標準のプルリフレッシュとの干渉を防止
- **受信トレイ**: スワイプでアーカイブ、タップで詳細パネル表示。一覧でtitle 2行+body 3行プレビュー、「もっと見る」で展開/折りたたみ。コメント通知から直接返信可能。`isMyChat()` 判定（`name === "マイチャット" || name === "general"`）でマイチャットのメンバー追加をAPI・UIで拒否
- **プロジェクト招待**: `inviteCode` 12文字。`/p/[code]` で招待ランディング。ワークスペースメンバーのみ参加可
- **Google認証紐付け**: プロフィール設定で `linkIdentity()` により既存メールアカウントにGoogle連携
- **サイドバー**: WorkspaceSidebar はトグルで展開/折りたたみ可能（展開時: アイコン+ラベル、折りたたみ時: アイコンのみ）
- **ChannelList 表示条件**: チャットページ（ワークスペースルート or `/channel/`）のみ表示。タスク・受信トレイ・ダッシュボード等では非表示
- **DatePicker**: `<input type="date">` ではなく `DatePicker` コンポーネント（ボタン+カレンダーポップオーバー）を使用。`date-fns` + `react-day-picker` ベース

## デプロイ・マージフロー

1. feature ブランチにコミット & プッシュ
2. Vercel のプレビュー URL を提示（`https://chatta-chat-<hash>-5y1u5s-projects.vercel.app` 形式）
3. ユーザーが動作確認 → マージ指示を待つ
4. 指示を受けてから main にマージ & プッシュ

**重要**: main へのマージはユーザーの明示的な指示があるまで行わない

## セキュリティ

- **RLS（Row Level Security）**: 全テーブルで有効化済み。ポリシーは未設定（= anon/authenticated からの直接アクセスを完全遮断）
- **データアクセス**: 全て Next.js API + Prisma 経由。Supabase REST API は認証確認のみに使用
- **認可**: アプリケーションレベルで `requireAuth()` + メンバーシップ確認。メッセージ/リアクション API は `channel.workspaceId` でワークスペース境界チェックを実施
- **ファイルアップロード**: Content-Type ホワイトリストで許可形式を制限（SVG/HTML 等 XSS リスクのある形式を除外）
- **セキュリティヘッダー**: `next.config.ts` で X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy を設定
- **RLS 設定 SQL**: `supabase/enable-rls.sql`（テーブル追加時は更新すること）
- **REPLICA IDENTITY SQL**: `supabase/enable-replica-identity.sql`（Realtime DELETE 対応）

## 事業開始チェックリスト

`tasks/business-launch-checklist.md` に、電気通信事業届出・利用規約・料金プラン等の事業化に必要なタスク一覧を管理。

## コーディング規約

- TypeScript strict モード
- 会話・コミット・コメントはすべて日本語
- feature ブランチで開発 → main へマージ（main に直接コミットしない）
