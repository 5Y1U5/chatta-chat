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

### 1. Task Realtime が配信されない（最重要）

**症状**: Message Realtime は OK だが、Task Realtime のみ Tab 間で反映されない（リロード必須）

**確認済みの正常項目**:
- Supabase RLS ポリシー（select_tasks_in_my_workspaces）は正しく定義
- supabase_realtime publication に Task テーブル含まれている
- Task の REPLICA IDENTITY = FULL
- ユーザーの supabaseUserId 紐付け正常、WorkspaceMember 所属正常
- useRealtimeTasks に workspaceId フィルタ追加済み（e3a1a37）

**仮説**:
- React #418 hydration error で TaskListView が正しく mount されず、useRealtimeTasks の subscribe が確立していない可能性が最有力
- WebSocket 接続自体が成立していない可能性も Computer Use の Network 観察から示唆

**次のステップ案**:
- Tab B の Console で `Supabase` / `Realtime` 関連ログを見る（subscribe status を確認）
- TaskListView の useEffect 内で `console.log` 追加して subscribe が走っているか直接確認
- ローカル開発環境（`npm run dev`）で再現テスト

### 2. React error #418 (Hydration mismatch) 連発

**症状**: Tab B で連続発生（5 件以上）

**疑わしい原因**: `TaskListView.tsx:145` の `useState(() => new Date())`
- SSR と CSR で `new Date()` の値が異なる → hydration 不一致
- 副作用で TaskListView が再マウント → 各 useEffect クリーンアップ＋再実行
- 上記 1 の Task Realtime subscribe 不安定の根本原因の可能性大

**修正案**:
```tsx
const [now, setNow] = useState<Date | null>(null)
useEffect(() => {
  setNow(new Date())
  // 既存の midnight タイマーロジック
}, [])
if (!now) return <SkeletonView />  // SSR は skeleton
```

または `suppressHydrationWarning` を該当箇所に付与。

### 3. タスクの DB 二重作成

**症状**: Tab A でインライン作成 or ダイアログ作成すると、まれに DB に同名タスクが 2 件作成される

**疑わしい原因**: 上記 React #418 で TaskListView が再マウントされ、handleInlineCreate / CreateTaskDialog の onSubmit が二重発火している

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
