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

### 1. Task Realtime が配信されない（2026-04-26 切り分け進捗あり）

**症状**: 
- INSERT イベントは Tab 間に届く（ただし 5 秒以内では未反映、10 秒以上で反映）
- UPDATE / DELETE イベントは反対 Tab に **完全に届かない**（21 秒経過しても反映なし）

**2026-04-26 の切り分け結果**:
- React #418 hydration error 修正（commit 836e6b9）後、TaskListView 側の subscribe 確立は安定
- `src/hooks/useRealtimeTasks.ts` のコードは INSERT/UPDATE/DELETE すべて正しく subscribe しており、`workspaceId=eq.${workspaceId}` フィルタ + 受信ハンドラとも問題なし
- → **原因はコード側ではなく Supabase 側の publication / REPLICA IDENTITY 設定**で確定的

**次に確認すべき SQL**（Supabase SQL Editor で実行）:

```sql
-- 1. supabase_realtime publication の operation flags
SELECT pubname, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication
WHERE pubname = 'supabase_realtime';
-- 期待: pubinsert=t, pubupdate=t, pubdelete=t

-- 2. Task テーブルが publication に含まれているか
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'Task';

-- 3. Task の REPLICA IDENTITY
SELECT relname,
  CASE relreplident
    WHEN 'd' THEN 'default'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END AS identity
FROM pg_class
WHERE relname = 'Task';
-- 期待: full

-- 4. RLS ポリシー（UPDATE/DELETE の SELECT 権限）
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'Task';
-- 期待: select_tasks_in_my_workspaces / SELECT / {authenticated}
```

**仮説候補**:
- (a) publication が `publish = 'insert'` のみで作成されている可能性（INSERT は来るが UPDATE/DELETE が来ない症状と一致）
- (b) Task の REPLICA IDENTITY が default のまま（PK のみ送信される。フィルタの workspaceId が payload に含まれず CSR 側でフィルタ落ちする可能性。ただし 4-25 セッションで FULL 設定済みのはず）
- (c) RLS ポリシーが SELECT のみで、Realtime UPDATE/DELETE 配信判定で別の cmd を要求している（仕様上は SELECT で十分なはずなので可能性低）

**修正候補（仮説 (a) の場合）**:
```sql
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');
```

**確認済みの正常項目**:
- Supabase RLS ポリシー（select_tasks_in_my_workspaces）は正しく定義
- supabase_realtime publication に Task テーブル含まれている（4-25 セッション時点）
- Task の REPLICA IDENTITY = FULL（4-25 セッション時点）

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
