# Realtime 復活 残課題（2026-04-25 引き継ぎ）

関連: `tasks/realtime-restore-plan.md` / `tasks/lessons.md`
親タスク: 2026-04-25 Realtime 復活 + 楽観的更新バグ修正

## 完了した作業（本番反映済み）

- ✅ Supabase RLS SELECT ポリシー 6 件を 6 テーブルに適用
- ✅ supabase_realtime publication に 6 テーブル追加（Message / Task / TaskComment / GuestComment / Notification / ChannelMember）
- ✅ Realtime hooks の snake_case → camelCase 修正（4 ファイル）
- ✅ useRealtimeNotifications に UPDATE 購読追加
- ✅ TaskListView / TaskDetailPanel / InboxView の楽観的更新ロールバック対応
- ✅ MessageView 楽観的メッセージの createdAt をサーバー値に統一
- ✅ useRealtimeTasks に workspaceId フィルタ追加（main: e3a1a37）
- ✅ tasks/lessons.md に 5 件の教訓追記
- ✅ Vercel preview 環境変数 6 件登録（NEXT_PUBLIC_SUPABASE_URL の `\n` 汚染除去含む）
- ✅ Supabase Auth Redirect URLs にワイルドカード 2 件追加（istyle / 5y1u5s-projects）
- ✅ Vercel Authentication（Deployment Protection）を OFF
- ✅ メッセージ Realtime の本番動作確認 OK

## 本番に残っている既知の問題（要追加調査）

### 1. Task Realtime UPDATE/DELETE 配信不通 — 2026-04-29 解決済み 🎉

**結果**: `WorkspaceMember` テーブルに SELECT ポリシー追加 (`select_my_workspace_memberships`) で完全解決。本番環境で Tab 間の INSERT / UPDATE / DELETE 配信を全項目 OK 確認。

**真因（2026-04-29 切り分け）**:

`Task` の SELECT ポリシー USING 句が `WorkspaceMember` をサブクエリ参照していたが、`WorkspaceMember` 自体は RLS 有効・ポリシー 0 件だった。authenticated ロールでサブクエリが空集合を返し、`Task` の RLS が常に false → Realtime postgres_changes が「見えない行」として配信を drop していた。

```sql
-- 真因に該当する状態（修正前）
-- Task の SELECT ポリシー
qual: ("workspaceId" IN (SELECT "workspaceId" FROM "WorkspaceMember" WHERE "userId" = current_user_id()))

-- WorkspaceMember
rls_enabled: true
ポリシー数: 0  ← ★これが原因
```

**修正 SQL**:
```sql
CREATE POLICY "select_my_workspace_memberships"
  ON public."WorkspaceMember"
  FOR SELECT
  TO authenticated
  USING ("userId" = current_user_id());
```

`supabase/enable-rls-policies.sql` セクション 7 として恒久反映済み（disable 側にも対応 DROP 文を追加）。

**INSERT は届いていたのに UPDATE/DELETE だけ来なかった理由**:
- Realtime postgres_changes の RLS 評価は INSERT/UPDATE/DELETE 全てで動作するが、UPDATE/DELETE は OLD 行に対しても評価されるため依存度が高い
- INSERT は表面的には届いていたが、5 秒以内では未反映で 10 秒以上経って反映 = `tab visibility change → syncInBackground()` で取得していた可能性が高く、純粋な Realtime 配信ではなかった
- 修正後は INSERT も 5〜10 秒以内に届くようになった（純 Realtime 経由）

**教訓**: `tasks/lessons.md` の 2026-04-29 エントリ参照（「RLS ポリシーのサブクエリ参照先テーブルにも SELECT ポリシーが必要」）。

### 2. React error #418 (Hydration mismatch) — 2026-04-26 修正済み

**結果**: commit `836e6b9` で修正完了。検証で 0 件確認。

**修正内容**: `TaskListView.tsx:145` の `useState(() => new Date())` を `null` 初期値 + `useEffect (setTimeout 0)` + 早期 return パターンに変更。詳細は `tasks/lessons.md` の 2026-04-26 エントリ参照。

### 3. タスクの DB 二重作成 — 2026-04-26 解消確認済み

**結果**: 上記 #2 の修正で連動解消。`POST /api/internal/tasks` が確実に 1 回のみ呼び出されることを 2 タブ環境で確認。

**確認方法**:
- 上記 2 を修正してから再現するか確認
- Network タブで POST /api/internal/tasks が 1 回 or 2 回発行されているか観察

### 4. Vercel preview の middleware 認証ループ（別系統の問題）

**症状**: preview URL でログイン後、 /login にリダイレクトループ

**確認済み**:
- Supabase auth cookies は正しく preview ドメインに設定されている（sb-fdyzyezajqdscctymqcy-auth-token.0/.1）
- Vercel Authentication は OFF 済み
- Preview 環境変数も登録済み

**未確認・仮説**:
- Edge runtime での @supabase/ssr の cookie 読み取り問題
- ES256 JWT 検証時の JWKS fetch が失敗している可能性
- preview ビルドが古いキャッシュを使っている可能性

**次のステップ案**:
- Vercel Function Logs を見て middleware が auth.getUser() で何を返しているか確認
- ローカルで `vercel dev` を使って同条件を再現テスト

### 5. 本番 Supabase 環境変数 NEXT_PUBLIC_SUPABASE_URL の `\n` 汚染

**症状**: 本番の NEXT_PUBLIC_SUPABASE_URL の値末尾に literal `\n`（backslash + n）が混入

**現状の影響**: 通常の Prisma 経由データ取得では URL 末尾汚染が問題にならず、アプリは動いている。OAuth フローで `${URL}/auth/v1/authorize` が `${URL_with_\n}/auth/v1/authorize` になり、本番でも今後 OAuth 関連で表面化するリスクあり。

**修正方法**:
1. Vercel ダッシュボード → Production env vars → NEXT_PUBLIC_SUPABASE_URL を編集
2. 値を `https://fdyzyezajqdscctymqcy.supabase.co` に上書き（末尾に何もない状態）
3. Production 再デプロイ

または CLI で:
```bash
export VERCEL_TOKEN=$(op read "op://Personal/VercelToken_5Y1U5/password")
cd ~/01_開発/01_自社プロダクト/ChattaChat
vercel env rm NEXT_PUBLIC_SUPABASE_URL production --token=$VERCEL_TOKEN --yes
vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "https://fdyzyezajqdscctymqcy.supabase.co" --token=$VERCEL_TOKEN
# 空コミット push で再デプロイ
```

## 推奨される次回作業順序

1. **#2 の React #418 修正**（最優先・最も明確）
   - `useState(() => new Date())` を遅延初期化パターンに変更
2. #1 の Task Realtime 再検証
   - #2 で hydration が直れば自動的に直る可能性大
3. #3 の DB 二重作成も同上で解消する可能性
4. #5 の本番環境変数クリーンアップ
5. #4 の preview middleware 問題（再発したら対応）

## セキュリティ TODO

- VERCEL_TOKEN（vcp_6qLeqZ...）を Revoke + 再発行（CLI plugin が token を hint メッセージに含めて表示してしまった件）
- ChattaChat .env.local の DATABASE_URL パスワードもローテート（過去のコマンド出力で露出）
