# タスク管理機能 開発計画

## Step 1: DB スキーマ + Prisma
- [x] Project, Task, TaskComment, Notification モデルを schema.prisma に追加
- [x] prisma db push でスキーマ反映
- [x] prisma generate でクライアント再生成

## Step 2: API（バックエンド）
- [x] /api/internal/projects/ — CRUD
- [x] /api/internal/tasks/ — CRUD + ステータス更新 + 担当者割当 + 通知生成
- [x] /api/internal/tasks/comments/ — タスク内チャット + 通知生成
- [x] /api/internal/notifications/ — 一覧取得 + 既読更新 + 全既読

## Step 3: マイタスク画面（UI）
- [x] サイドバーに「マイタスク」「受信トレイ」メニュー追加（PC・モバイル両対応）
- [x] マイタスク一覧ページ（ステータス別グルーピング: 未着手/進行中/完了）
- [x] タスク作成ダイアログ（タイトル、担当者、優先度、プロジェクト、期日）
- [x] タスク詳細パネル（説明、サブタスク、コメント、全フィールド編集）

## Step 4: プロジェクト機能（UI）
- [x] サイドバー（ChannelList）にプロジェクトセクション追加
- [x] プロジェクト一覧ページ + 作成ダイアログ（カラー選択対応）
- [x] プロジェクト別タスク一覧（マイタスクと同じ TaskListView を再利用）

## Step 5: 受信トレイ
- [x] 通知一覧画面（未読/既読の視覚的区別）
- [x] タスク完了・コメント・担当割当時の通知自動生成
- [x] WorkspaceSidebar に未読バッジ表示

## Step 6: 繰り返しタスク
- [ ] RRULE パーサー（rrule ライブラリ）
- [ ] 繰り返し設定 UI
- [ ] 完了時の次回タスク自動生成

## ビルド確認
- [x] `npm run build` 成功（型エラーなし）
