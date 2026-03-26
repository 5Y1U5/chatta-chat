-- ============================================================
-- ChattaChat: 全テーブルに Row Level Security (RLS) を有効化
-- ============================================================
--
-- 背景:
--   ChattaChat は全データアクセスを Next.js API + Prisma 経由で行う。
--   Prisma は DATABASE_URL（postgres ロール）で直接接続するため RLS の影響を受けない。
--   RLS は Supabase REST API（anon/authenticated ロール）経由の
--   不正アクセスをブロックするための深層防御として設定する。
--
-- 方針:
--   1. 全テーブルで RLS を有効化
--   2. permissive ポリシーを作成しない → anon/authenticated からの直接アクセスを完全遮断
--   3. Prisma（postgres ロール）は RLS をバイパスするため影響なし
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor でこのファイルの内容を実行
-- ============================================================

-- RLS を有効化（既に有効な場合はスキップされる）
ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ChannelMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ChannelMemory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TaskMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TaskComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Notification" ENABLE ROW LEVEL SECURITY;

-- RLS が有効でポリシーがないテーブルは、テーブルオーナー（postgres）以外の
-- ロール（anon, authenticated）からのアクセスが全て拒否される。
-- これが意図した動作: Supabase REST API からの直接アクセスをブロック。

-- 確認用クエリ: RLS の状態を一覧表示
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
