# Lessons Learned

## 2026-03-26: Vercel Edge Runtime で Prisma は使用不可

**問題**: middleware.ts に `getPrisma()` を追加したところ、ローカルビルドは成功するが Vercel デプロイが全て失敗。数時間気づかなかった。

**原因**: Next.js の middleware は Vercel Edge Runtime で実行され、Node.js 専用モジュール（pg, fs, crypto等）が使用できない。

**ルール**: middleware.ts では Supabase Auth（Edge 対応）のみ使用する。DB アクセスは Server Component や API Route で行う。

## 2026-03-26: デプロイ成否の確認を怠らない

**問題**: PR マージ後にデプロイが失敗していたことに気づかず、「反映されない」と何度もやり取りした。

**ルール**: マージ後に必ず `gh api repos/.../deployments/.../statuses` でデプロイ成否を確認する。本番URLに curl して期待するコンテンツが返るかも確認する。

## 2026-03-26: ChattaChat の正しい Vercel URL

**問題**: `chatta-zeta.vercel.app` は古いプロジェクト。正しくは `chatta-chat.vercel.app`。

**ルール**: Vercel プロジェクト名は `chatta-chat`。URL は `https://chatta-chat.vercel.app`。

## 2026-03-26: Galaxy Z Fold は画面幅 768px 以上の可能性

**問題**: `useIsMobile()` の MOBILE_BREAKPOINT=768 では Galaxy Z Fold の開いた状態を「モバイル」と判定できない場合がある。

**ルール**: TaskDetailPanel のように `md:hidden` で戻るボタンを制御する場合、完了ボタン等も同じ `md:` ブレークポイントで統一する。`isMobile` と CSS `md:` を混在させない。

## 2026-03-26: .env.local の DB URL に \n リテラルが含まれていた

**問題**: `prisma db push` が `postgres\n` という別のデータベースにスキーマを適用し、本番DBにテーブルが作成されなかった。統合APIが500エラーを返し、サブタスク・コメントが表示されなくなった。

**原因**: `.env.local` の DATABASE_URL / DIRECT_URL の末尾に `\n` がリテラル文字列として含まれていた。

**ルール**:
- `prisma db push` 実行時、出力の `database "xxx"` 部分を必ず確認する。`postgres\n` のように余計な文字がないか注意。
- `prisma.config.ts` で URL に `.trim()` を適用する。
- スキーマ変更後は SQL で新テーブルの存在を実際に確認する。

## 2026-04-17: Realtime UPDATE で全置換 GET は楽観的更新を破壊する

**問題**: タスク完了をクリックすると楽観的に done になるが、直後に todo に戻る事象。リロードすると done になっている。

**原因**: `useRealtimeTasks` の UPDATE ハンドラが `syncInBackground()` → `GET /api/internal/tasks` → `setTasks(data)` で state を全置換していた。ユーザーの PATCH 確定前に別タスクの Realtime UPDATE が走ると、GET が古いデータを返して楽観的更新がロールバックされる（`TaskListView.tsx`）。

**ルール**:
- Realtime UPDATE イベントは `payload.new` を直接ローカル state にマージする（全置換 GET しない）。
- join データ（assignee/project 等）は members/projects 配列から再解決する。
- INSERT のみは join データ取得のため GET で補完してよい。
- REPLICA IDENTITY FULL を設定したテーブル（Task 等）は `payload.new` に全カラムが含まれるので直接マージ可能。

## 2026-04-17: useEffect の依存配列に controlled input の value を入れない

**問題**: タスク詳細の説明欄に入力した文字が、打ち終わる前に消える。外枠クリック（onBlur）すると保存される。

**原因**: `TaskDetailPanel.tsx` の useEffect 依存配列に `currentTask.description` が含まれており、Realtime で props が変わるたびに `setDescription(currentTask.description || "")` が発火してローカル state を上書きしていた。

**ルール**:
- controlled input のローカル state を `props.value` から毎回リセットする useEffect を書かない。
- タスク切り替え等のライフサイクルで初期化したいなら、依存を id（識別子）に絞る。
- 他ユーザーの編集を取り込む場合は、**自分が編集中（dirty フラグ）でないときだけ** 取り込む補助 effect を分離する。
