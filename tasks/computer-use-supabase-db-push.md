# Computer Use 用プロンプト：Supabase に Task.archived カラムを反映

> ⚠️ **このドキュメントは過去ログ（2026-04-26 に Supabase SQL Editor から直接 ALTER TABLE で対応済み）**
> ローカルからの `prisma db push` が P1000 で失敗していたため当時作成したが、最終的には Supabase ダッシュボード SQL Editor から直接 `ALTER TABLE "Task" ADD COLUMN ... archived` を実行して解決。同時に複合インデックス `Task_workspaceId_archived_idx` も作成済み。詳細は `~/01_開発/10_その他/Vercelハッキング対応/tasks/worklog.md` の 2026-04-26 / A-2-1 セクション参照。

## 使い方

1. Claude.ai（Web）の Computer Use 機能を起動
2. 「## プロンプト本文（ここから下をコピペ）」以降をそのままコピーして貼り付け
3. Computer Use が画面操作を開始する → 進捗を見守る
4. 1Password / Supabase / Vercel のログインが要求されたら、人間（あなた）がパスワード入力
5. 完了報告を待つ

---

## プロンプト本文（ここから下をコピペ）

# タスク

ChattaChat プロジェクトの Prisma スキーマに追加した `Task.archived` カラム（Boolean、default false）を、Supabase の本番 DB に反映してください。あわせて、ローカル `.env.local` と Vercel 環境変数の DB パスワードも、Supabase の現行パスワードに同期してください。

## 前提

- 作業マシン: Mac mini（macOS、ターミナルは Superset。`cmd+space` → "Superset" で起動）
- リポジトリパス: `/Users/takahashiyuuki/01_開発/01_自社プロダクト/ChattaChat`
- DB: Supabase（プロジェクト名: chatta-chat）
- ホスティング: Vercel（プロジェクト名: chatta-chat）
- パスワード管理: 1Password CLI (`op`) / ボールトは `Personal`
- 直近のコミット `fb67a4b` で `prisma/schema.prisma` の Task モデルに以下が追加済み:
  ```
  archived       Boolean   @default(false)
  @@index([workspaceId, archived])
  ```
- 過去に `npx prisma db push` を試したが `P1000: Authentication failed` で失敗
  → `.env.local` の `DATABASE_URL` / `DIRECT_URL` のパスワードが古い疑い

## 完了条件

以下 4 つすべてが満たされたら完了:

1. Supabase Dashboard の Table Editor で、`Task` テーブルに `archived`（型 `bool`、default `false`）カラムが見えること
2. ローカルで `npx --yes dotenv-cli -e .env.local -- npx prisma db push` が成功すること
3. 新パスワードが 1Password に保存されていること（アイテム名: `SupabaseDBPassword_ChattaChat`）
4. Vercel の Environment Variables で `DATABASE_URL` / `DIRECT_URL` が新パスワードに更新され、再デプロイが成功していること

## 手順

### Step 0: ターミナルを開いてリポジトリへ移動

```
cd /Users/takahashiyuuki/01_開発/01_自社プロダクト/ChattaChat
git log --oneline -1
```

最新コミットが `fb67a4b feat(tasks): 複数選択での一括削除/アーカイブ...` であることを確認。違っていたら `git pull` してから続行。

### Step 1: 1Password に既存パスワードがあるか確認

```
op item list --vault Personal | grep -i -E "(supabase|chatta)"
```

該当アイテムが見つかったら:

```
op item get "<アイテム名>" --vault Personal --fields password --reveal
```

→ 取得できたパスワードを `.env.local` の現値と比較（次の Step 2）。一致するなら Step 4 へ。違うなら Step 3 でリセット。

### Step 2: .env.local の現値を確認

```
grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local
```

`postgresql://postgres.xxxxx:【ここがパスワード】@aws-1-ap-northeast-1.pooler.supabase.com:....` の `:` と `@` の間の文字列が現在のパスワード。1Password の値と一致しないなら Step 3 へ。

### Step 3: Supabase で Database Password をリセット

1. ブラウザで https://supabase.com/dashboard を開く（要ログインなら人間に依頼）
2. プロジェクト `chatta-chat` を選択
3. 左サイドバー下部の歯車 → `Project Settings` → `Database`
4. `Database password` セクションの `Reset database password` をクリック
5. 新しいパスワードを生成 → コピー（クリップボードに保持）
6. **すぐに 1Password に保存**:
   ```
   op item create --category=password --title="SupabaseDBPassword_ChattaChat" --vault=Personal password='【コピーしたパスワード】' --tags=db,supabase
   ```
   既存アイテムを更新する場合:
   ```
   op item edit "SupabaseDBPassword_ChattaChat" --vault=Personal password='【新パスワード】'
   ```
7. 同じ画面の `Connection string` セクションで以下のフォーマットを確認:
   - `Transaction pooler` (port 6543) → `DATABASE_URL` に使う
   - `Session pooler` (port 5432) → `DIRECT_URL` に使う
   - 両方とも `[YOUR-PASSWORD]` プレースホルダになっているので、新パスワードに置換

### Step 4: .env.local を更新

VS Code で開く:
```
code /Users/takahashiyuuki/01_開発/01_自社プロダクト/ChattaChat/.env.local
```

`DATABASE_URL` と `DIRECT_URL` の `:` と `@` の間（パスワード部分）を新パスワードに書き換える。

**重要 — URL エンコード**: パスワードに `@` `/` `:` `#` `?` `%` などの記号が含まれる場合は URL エンコードが必要。

エンコード確認コマンド:
```
node -e "console.log(encodeURIComponent('【生パスワード】'))"
```

例: `pa@ss/word` → `pa%40ss%2Fword`

書き換え後の例:
```
DATABASE_URL="postgresql://postgres.xxxxx:NEW_ENCODED_PWD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:NEW_ENCODED_PWD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

保存して閉じる。

### Step 5: db push を実行

```
cd /Users/takahashiyuuki/01_開発/01_自社プロダクト/ChattaChat
npx --yes dotenv-cli -e .env.local -- npx prisma db push
```

成功時の出力（抜粋）:
```
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-ap-northeast-1.pooler.supabase.com:5432"
🚀  Your database is now in sync with your Prisma schema. Done in Xs
✔ Generated Prisma Client
```

`P1000` が再発したら Step 3 のパスワードリセットからやり直し。
データ損失警告（`The following migration(s) might lead to data loss`）が出たら **停止して報告**（archived 追加だけなら警告は出ないはず）。

### Step 6: Supabase Dashboard で反映を確認

1. ブラウザで https://supabase.com/dashboard → プロジェクト `chatta-chat`
2. 左サイドバー `Table Editor` → `Task` テーブルを開く
3. カラム一覧に `archived`（型 `bool`、Default Value `false`）が見えること
4. 既存行の `archived` がすべて `false` になっていること（NULL でないこと）

### Step 7: Vercel の環境変数を更新

1. ブラウザで https://vercel.com/dashboard を開く（要ログインなら人間に依頼）
2. プロジェクト `chatta-chat` を選択
3. `Settings` タブ → `Environment Variables`
4. `DATABASE_URL` の編集ボタン → 新パスワードに置換 → Production / Preview / Development すべてのチェックを保ったまま Save
5. `DIRECT_URL` も同じく編集 → Save
6. `Deployments` タブ → 最新の Production デプロイの右側「⋯」 → `Redeploy` → `Use existing Build Cache` のチェックは外して再デプロイ
7. ビルド完了まで待つ（2-3 分）→ ステータスが `Ready` になること

### Step 8: 動作確認（任意・推奨）

- ブラウザで本番 URL を開いて、タスク一覧で「⋯」メニューから「アーカイブ」を実行
- アーカイブしたタスクが一覧から消えれば成功
- ブラウザのコンソール / Network タブで 500 エラーが出ていないこと

## 完了時の報告フォーマット

以下を Claude Code に貼り付けて報告:

```
[Computer Use 完了報告]

✓ Step 5: prisma db push 成功
  実行結果のラスト 5 行: 
  ...

✓ Step 6: Supabase Task.archived カラム確認済み
  - 型: bool
  - default: false

✓ Step 3 / 1Password 保存完了
  アイテム名: SupabaseDBPassword_ChattaChat

✓ Step 7: Vercel 環境変数更新 + 再デプロイ完了
  デプロイURL: https://chatta-chat-xxxxx.vercel.app
  ステータス: Ready

任意確認:
- 本番でアーカイブ動作: 確認済み / 未確認
```

## 失敗時の対応

| エラー | 対処 |
|---|---|
| `P1000 Authentication failed` | Step 3 のパスワードリセットからやり直し |
| `password authentication failed for user "postgres..."` | URL エンコードを再確認（Step 4 の node コマンド） |
| `data loss might be caused` | 停止して Claude Code に報告（想定外）|
| `op: command not found` | Homebrew で `brew install --cask 1password-cli` |
| `dotenv-cli` のダウンロードに時間がかかる | `npm i -g dotenv-cli` を一度実行しておく |
| Vercel 再デプロイがビルドエラー | ビルドログ全文を Claude Code に転送 |

## 安全注意

- パスワード値を **スクリーンショット・画面録画・テキストメモ・チャット** に残さないこと
- 1Password と `.env.local` 以外の場所にパスワードを保存しないこと
- destructive な操作（DROP TABLE 等）を求められたら停止して人間に確認
- `git status` で `.env.local` が untracked になっていることを確認（誤って commit されないよう）
- 不明点があれば操作を止めて人間に確認

## 参考: 何が変わるか（DBの中身）

Step 5 の db push で実行される SQL（イメージ）:
```sql
ALTER TABLE "Task" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Task_workspaceId_archived_idx" ON "Task"("workspaceId", "archived");
```

既存行は default 値 `false` で埋まる。ロールバック可能（カラム drop で戻せる）。
