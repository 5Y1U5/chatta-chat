# Realtime 復活 + 楽観的更新バグ修正 計画書

> ⚠️ **このドキュメントは過去ログ（2026-04-29 で完全完了）**
> 2026-04-25 にメッセージ Realtime + RLS + 楽観的更新を復活、2026-04-26 に React #418 修正、2026-04-29 に Task Realtime UPDATE/DELETE を完全解決。最新は `tasks/realtime-restore-known-issues.md` および `tasks/lessons.md` を参照。

作成: 2026-04-25
ブランチ: `refactor/realtime-restore`（main マージ後 2026-04-26 に削除）
関連: `~/01_開発/10_その他/Vercelハッキング対応/2026-04-23_残タスク.md`

## 背景

2026-04-25 の Vercel インシデント残タスク対応中に判明:
1. Supabase Realtime（postgres_changes）が現状動いていない（メッセージ・タスク変更がリロードしないと反映されない）
2. ユーザー報告: 「タスク完了・変更で 1 回目では反映されず、2 回目で反映される」現象

## 調査で判明した問題（一次切り分け済み）

### 問題 1: Realtime 完全停止
全テーブル RLS 有効・ポリシー 0 件のため、anon/authenticated ロールでの SELECT が完全遮断 → `postgres_changes` イベントが配信されない。

該当テーブル:
- Message, Task, TaskComment, GuestComment, Notification, ChannelMember
- Reaction, ChannelMemory（Realtime 購読していないが将来必要なら）

### 問題 2: 楽観的更新まわりの局所バグ

| # | 箇所 | 問題 |
|---|---|---|
| 2-1 | `TaskListView.tsx:315-352` | `handleDueDateChange` / `handleStartDateChange` / `handleRecurrenceChange` が fire-and-forget（.catch 無し、ロールバック無し） |
| 2-2 | `useRealtimeNotifications.ts:33-63` | INSERT のみ購読、UPDATE/DELETE 未購読 → 既読化・アーカイブが他端末・他タブに反映されない |
| 2-3 | `MessageView.tsx:177` | 楽観的メッセージの `createdAt` がローカル現在時刻 → サーバ DB 値とズレ、並び順乱れ |
| 2-4 | `TaskListView.tsx` Realtime UPDATE callback | `payload.new` をマージする際の closure 戦略は lessons.md 教訓は反映されているが、members 配列が古い時に join データ補完が壊れる可能性 |
| 2-5 | `TaskDetailPanel.tsx:151-186` | useEffect 依存が `currentTask.id` のみ → 同じタスクの Realtime UPDATE が反映されない（dirty フラグ分離未実装） |
| 2-6 | API 全般 | `revalidatePath` / `revalidateTag` 未使用 → ページ再訪時に Server Component の古いキャッシュが残存 |
| 2-7 | `route.ts:` reorder | 並び替え API が `{ success: true }` のみ返却 → 失敗時の正解 state を復元できない |
| 2-8 | InboxView 既読化・アーカイブ | レスポンス無視（fire-and-forget） |

### 「2 回目で反映される」現象の主因仮説

問題 1 が根本原因。Realtime が来ないため、楽観的更新で表示は変わるが、画面遷移・フォーカス・別タスク選択などで Server Component が古い props を再注入したり、useEffect が再 fetch したりして「2 回目の何か」で本来の値に確定して見える。問題 2-1 / 2-2 / 2-8 は Realtime 不在を露骨に悪化させる二次要因。

## 修正方針（並列ワーク 3 トラック）

### トラック A: Supabase RLS ポリシー設計・適用（DB 側、独立）

**目的**: Realtime が anon ロールで配信されるよう SELECT ポリシーを 6 テーブルに付与。Prisma 経由（postgres ロール）はバイパスのまま影響なし。

#### ステップ
- A1. `User.supabaseUserId` の埋まり具合を全件確認（NULL があると認可が崩れる）
- A2. ポリシー設計（メンバーシップ経由）
  - **Message**: 自分が参加している Channel のメッセージのみ SELECT 可
  - **Task**: 自分が参加している Workspace のタスクのみ SELECT 可
  - **TaskComment**: 紐付く Task が SELECT 可なら可
  - **GuestComment**: 同上
  - **Notification**: `userId` が自分のみ
  - **ChannelMember**: 自分の所属だけ
- A3. SQL 作成: `supabase/enable-rls-policies.sql`
- A4. ステージング検証: 別ユーザー A/B でクロスチェック（A が B のメッセージを見られないこと）
- A5. 本番適用（手動 or Computer Use プロンプト）

#### 完了基準
- 別ブラウザでログインしたユーザーから他人のチャネル・タスク・通知が `select * from public."Message"` で見えない
- 自分宛は見える
- アプリ動作に影響なし（Prisma 経由は無関係）
- メッセージ・タスク完了が他タブにリアルタイム反映される

### トラック B: 楽観的更新バグ修正（フロントコード、独立）

並列実行可能な 6 サブタスク:

- **B1. fire-and-forget mutation の修正**
  - 対象: `TaskListView.tsx`（dueDate, startDate, recurrence）, `InboxView.tsx`（read, archive）
  - 修正: `.then` でレスポンス確定 → 失敗時に楽観的更新をロールバック
  
- **B2. `useRealtimeNotifications` に UPDATE/DELETE 購読追加**
  - INSERT に加えて UPDATE（既読化）, DELETE（アーカイブ）も購読
  - `useUnreadCounts` の再計算が連動するように
  
- **B3. `MessageView` 楽観的メッセージ修正**
  - `createdAt` をサーバ返却値で再構築
  - `id` も DB 払出し ID に統一済みなので OK だが、表示用フィールドの一貫性を再確認
  
- **B4. Realtime UPDATE merge の堅牢化**
  - `useRealtimeTasks` / `useRealtimeMessages` のマージ関数を functional setState で統一
  - join データ（assignee, project, member）の解決時に **更新前 state の値を尊重するフォールバック** を追加
  
- **B5. `TaskDetailPanel` の useEffect 分離**
  - id 切り替え時の初期化 effect と、Realtime UPDATE 取り込みを分離
  - dirty フラグ（編集中フラグ）導入: 入力中フィールドは Realtime UPDATE で上書きしない
  
- **B6. `revalidatePath` の最小限導入**
  - 過剰追加しない: layout の Suspense 境界が古いキャッシュを返す原因になる箇所のみ
  - 候補: タスク作成・削除時の `tasks` ナビカウント、通知バッジの未読数

#### 完了基準
- 期日・開始日・繰り返しの変更がエラー時にロールバックされる
- 別タブで通知を既読化したら、こちらのタブでも未読バッジが更新される
- メッセージ送信時刻の表示と DB 値が一致
- 入力途中のテキストが Realtime UPDATE で消えない

### トラック C: 動作検証 + デプロイ（最後）

- C1. ローカル `npm run dev` で 2 ブラウザ動作確認（メッセージ・タスク・通知）
- C2. Vercel preview デプロイ → ユーザー確認
- C3. main マージ → 本番反映 + Realtime 動作の再確認
- C4. lessons.md 更新（今回の学習を追記）

## 並列実行プラン

```
時間軸 ──────────────────────────────────────────►

A1 → A2 → A3（SQL 作成）─── A4 → A5（適用）
            │
B1, B2, B3, B4, B5, B6（コード修正、A と独立）
            │
            └─→ C1（A 適用済み DB に対してローカル検証）
                  │
                  C2（preview）→ C3（本番）→ C4（lessons）
```

実行戦略:
- ブランチ `refactor/realtime-restore` を切る
- A の SQL 作成と B の各サブタスクは並列で進める（サブエージェントまたは順次）
- A の本番適用は B の修正がマージされてから（Realtime が機能し始める瞬間に UI バグが残っていると逆に混乱）

## 想定リスク・ロールバック

| リスク | 対策 |
|---|---|
| RLS ポリシーミスでデータ漏洩 | ステージング検証必須。クロスユーザーテストで他人のデータが見えないことを確認 |
| RLS ポリシーが厳しすぎて Realtime 来ない | SQL に `DROP POLICY` を併記して即時ロールバック可能に |
| フロント修正で別バグ混入 | feature ブランチで Vercel preview 確認 |
| Realtime 復活で大量イベント発生 → クライアント負荷 | 既存実装のフィルタ（workspaceId 等）が機能しているか確認 |

## ロールバック手順

1. RLS ポリシー: `supabase/disable-rls-policies.sql`（A3 と一緒に作成）で即時ロールバック
2. フロント: `git revert` で feature ブランチのコミットを戻す → main に再 push
3. 緊急時は Vercel ダッシュボードから前バージョンへロールバック

## ユーザー確認ポイント

- [ ] このトラック分けで OK か
- [ ] RLS 適用は「ステージング → 本番」か、`User.supabaseUserId` 確認後に本番直行か
- [ ] ブランチ名 `refactor/realtime-restore` で OK か
- [ ] 並列化は「サブエージェント並列」か「自分が順次対応」か（前者はコンテキスト分離、後者は確実性重視）
- [ ] B6（revalidatePath）は今回スコープに含めるか、別タスク化するか

## 関連ファイル

- `supabase/enable-rls.sql`（既存）
- `supabase/enable-replica-identity.sql`（既存）
- `supabase/enable-rls-policies.sql`（新規作成予定）
- `src/hooks/useRealtime*.ts`（修正対象）
- `src/components/task/TaskListView.tsx`, `TaskDetailPanel.tsx`, `InboxView.tsx`
- `src/components/chat/MessageView.tsx`
- `tasks/lessons.md`（完了後追記）
